import { expect, test, type Locator, type Page } from "@playwright/test";

import { dragHandleToTarget } from "./helpers/dnd";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
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

async function createList(page: Page, title: string) {
  await page.getByText("+ Add another list").click();
  await page.getByPlaceholder("Enter list title...").fill(title);
  await page.getByRole("button", { name: "Add list" }).click();
  await expect(listColumn(page, title)).toBeVisible({ timeout: 15_000 });
}

async function addCardToList(page: Page, sourceListTitle: string, cardTitle: string) {
  const column = listColumn(page, sourceListTitle);

  await column.getByText("+ Add a card").click();
  await column.getByPlaceholder("Enter a title for this card...").fill(cardTitle);
  await column.getByRole("button", { name: "Add card" }).click();
  await expect(cardInList(column, cardTitle)).toBeVisible({ timeout: 15_000 });
}

test.describe("Milestone 1 happy path", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run E2E tests.",
  );

  test("login -> create workspace/board/list/card -> drag card and reorder lists", async ({ page }) => {
    await loginWithPassword(page, TEST_EMAIL!, TEST_PASSWORD!);

    const workspaceName = uniqueName("e2e-workspace");
    const boardName = uniqueName("e2e-board");
    const todoListName = uniqueName("todo");
    const doneListName = uniqueName("done");
    const cardTitle = uniqueName("card");

    await page.getByLabel("Workspace name").fill(workspaceName);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/w$/);

    await page.getByRole("button", { name: "Create new" }).click();
    await expect(page.getByRole("heading", { name: "Tạo bảng" })).toBeVisible();
    await page.getByLabel("Tiêu đề bảng *").fill(boardName);
    await page.getByRole("button", { name: "Tạo mới" }).click();

    await expect(page).toHaveURL(/\/w\/[^/]+\/board\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: boardName })).toBeVisible();

    await createList(page, todoListName);
    await createList(page, doneListName);
    await addCardToList(page, todoListName, cardTitle);

    const todoColumn = listColumn(page, todoListName);
    const doneColumn = listColumn(page, doneListName);

    await expect(cardInList(todoColumn, cardTitle)).toBeVisible();
    await expect(cardInList(doneColumn, cardTitle)).toHaveCount(0);

    const cardContainer = cardInList(todoColumn, cardTitle);

    await dragHandleToTarget(
      page,
      cardContainer.getByRole("button", { name: "Move card" }),
      doneColumn.getByText("Drop card here"),
    );

    await expect(cardInList(doneColumn, cardTitle)).toBeVisible({ timeout: 15_000 });
    await expect(cardInList(todoColumn, cardTitle)).toHaveCount(0);

    await dragHandleToTarget(
      page,
      doneColumn.getByRole("button", { name: "Move list" }),
      todoColumn.getByRole("button", { name: "Move list" }),
    );

    await expect
      .poll(async () => {
        const doneBounds = await listColumn(page, doneListName).boundingBox();
        const todoBounds = await listColumn(page, todoListName).boundingBox();

        if (!doneBounds || !todoBounds) {
          return false;
        }

        return doneBounds.x < todoBounds.x;
      })
      .toBe(true);
  });
});
