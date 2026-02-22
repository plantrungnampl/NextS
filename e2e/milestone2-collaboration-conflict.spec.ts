import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import { dragHandleToTarget } from "./helpers/dnd";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
const TEST_EMAIL_2 = process.env.E2E_TEST_EMAIL_2 ?? TEST_EMAIL;
const TEST_PASSWORD_2 = process.env.E2E_TEST_PASSWORD_2 ?? TEST_PASSWORD;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function resolveBaseUrl(testInfo: TestInfo): string {
  const configuredBaseUrl = testInfo.project.use.baseURL;
  if (typeof configuredBaseUrl === "string" && configuredBaseUrl.length > 0) {
    return configuredBaseUrl;
  }

  return process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
}

function listColumn(page: Page, listTitle: string): Locator {
  return page.locator("article").filter({
    has: page.getByRole("button", { name: "Move list" }),
    hasText: listTitle,
  }).first();
}

function cardInList(column: Locator, cardTitle: string): Locator {
  return column.locator("article").filter({
    hasText: cardTitle,
  }).first();
}

async function loginWithPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to NexaBoard" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/w$/);
  await expect(page.getByRole("heading", { name: "Recently viewed" })).toBeVisible();
}

async function createWorkspace(page: Page, workspaceName: string) {
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/w$/);
}

async function createBoardFromModal(page: Page, boardName: string) {
  await page.getByRole("button", { name: "Create new" }).click();
  await expect(page.getByRole("heading", { name: "Tạo bảng" })).toBeVisible();

  await page.getByLabel("Tiêu đề bảng *").fill(boardName);
  await page.getByRole("button", { name: "Tạo mới" }).click();

  await expect(page).toHaveURL(/\/w\/[^/]+\/board\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: boardName })).toBeVisible();
}

async function createList(page: Page, title: string) {
  await page.getByText("+ Add another list").click();
  await page.getByPlaceholder("Enter list title...").fill(title);
  await page.getByRole("button", { name: "Add list" }).click();

  await expect(listColumn(page, title)).toBeVisible({ timeout: 15_000 });
}

async function addCardToList(page: Page, listTitle: string, cardTitle: string) {
  const column = listColumn(page, listTitle);
  await column.getByText("+ Add a card").click();
  await column.getByPlaceholder("Enter a title for this card...").fill(cardTitle);
  await column.getByRole("button", { name: "Add card" }).click();

  await expect(cardInList(column, cardTitle)).toBeVisible({ timeout: 15_000 });
}

async function locateCardTargetList(page: Page, listTitles: string[], cardTitle: string): Promise<string> {
  for (const title of listTitles) {
    if (await cardInList(listColumn(page, title), cardTitle).count()) {
      return title;
    }
  }

  return "pending";
}

test.describe("Milestone 2 collaboration conflict handling", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run E2E tests.",
  );

  test("two sessions moving same card converge to one canonical state", async ({ browser }, testInfo) => {
    test.setTimeout(90_000);

    const baseURL = resolveBaseUrl(testInfo);
    const userAContext = await browser.newContext({ baseURL });
    const userBContext = await browser.newContext({ baseURL });

    const userAPage = await userAContext.newPage();
    const userBPage = await userBContext.newPage();

    try {
      await loginWithPassword(userAPage, TEST_EMAIL!, TEST_PASSWORD!);
      await loginWithPassword(userBPage, TEST_EMAIL_2!, TEST_PASSWORD_2!);

      const workspaceName = uniqueName("collab-ws");
      const boardName = uniqueName("collab-board");
      const todoList = uniqueName("todo");
      const doingList = uniqueName("doing");
      const doneList = uniqueName("done");
      const cardTitle = uniqueName("card");

      await createWorkspace(userAPage, workspaceName);
      await createBoardFromModal(userAPage, boardName);
      await createList(userAPage, todoList);
      await createList(userAPage, doingList);
      await createList(userAPage, doneList);
      await addCardToList(userAPage, todoList, cardTitle);

      const boardUrl = userAPage.url();
      await userBPage.goto(boardUrl);
      await expect(userBPage.getByRole("heading", { name: boardName })).toBeVisible();
      await expect(cardInList(listColumn(userBPage, todoList), cardTitle)).toBeVisible({ timeout: 15_000 });

      const userATodo = listColumn(userAPage, todoList);
      const userADoing = listColumn(userAPage, doingList);
      const userBTodo = listColumn(userBPage, todoList);
      const userBDone = listColumn(userBPage, doneList);
      const userACard = cardInList(userATodo, cardTitle);
      const userBCard = cardInList(userBTodo, cardTitle);

      await Promise.all([
        dragHandleToTarget(
          userAPage,
          userACard.getByRole("button", { name: "Move card" }),
          userADoing.getByText("Drop card here"),
        ),
        dragHandleToTarget(
          userBPage,
          userBCard.getByRole("button", { name: "Move card" }),
          userBDone.getByText("Drop card here"),
        ),
      ]);

      await expect.poll(async () => {
        await userAPage.reload();
        const inTodo = await cardInList(listColumn(userAPage, todoList), cardTitle).count();
        const target = await locateCardTargetList(userAPage, [doingList, doneList], cardTitle);
        if (inTodo > 0 || target === "pending") {
          return "pending";
        }

        return target;
      }, { timeout: 45_000 }).not.toBe("pending");

      const finalTargetOnUserA = await locateCardTargetList(userAPage, [doingList, doneList], cardTitle);

      await expect.poll(async () => {
        await userBPage.reload();
        return locateCardTargetList(userBPage, [doingList, doneList], cardTitle);
      }, { timeout: 45_000 }).toBe(
        finalTargetOnUserA,
      );
      await expect(cardInList(listColumn(userAPage, todoList), cardTitle)).toHaveCount(0);
      await expect(cardInList(listColumn(userBPage, todoList), cardTitle)).toHaveCount(0);
    } finally {
      await userAContext.close();
      await userBContext.close();
    }
  });
});
