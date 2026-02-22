import { expect, test, type Locator, type Page } from "@playwright/test";

import { dragHandleToTarget } from "./helpers/dnd";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function listColumn(page: Page, listTitle: string): Locator {
  return page.locator("[data-lane-pan-stop]").filter({
    has: page.getByRole("button", { name: "Move list" }),
    has: page.getByRole("button", { exact: true, name: listTitle }),
  }).first();
}

function cardInList(column: Locator, cardTitle: string): Locator {
  return column
    .getByRole("button", { exact: true, name: cardTitle })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'group/card')][1]");
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

async function createWorkspaceIfAvailable(page: Page, workspaceName: string) {
  const workspaceNameInput = page.getByLabel("Workspace name");
  const hasWorkspaceInput = await workspaceNameInput.count();
  if (hasWorkspaceInput > 0) {
    const isVisible = await workspaceNameInput.first().isVisible().catch(() => false);
    if (isVisible) {
      await workspaceNameInput.fill(workspaceName);
      await page.getByRole("button", { name: "Create workspace" }).click();
      await expect(page).toHaveURL(/\/w$/);
      return;
    }
  }
}

async function createBoardFromModal(page: Page, boardName: string) {
  const createNewButton = page.getByRole("button", { name: /Create new|Tạo mới/i }).first();
  const createNewLink = page.getByRole("link", { name: /Create new|Tạo mới/i }).first();
  if (await createNewButton.count()) {
    await createNewButton.click();
  } else {
    await createNewLink.click();
  }
  await expect(page.getByRole("heading", { name: "Tạo bảng" })).toBeVisible();

  await page.getByLabel("Tiêu đề bảng *").fill(boardName);
  await page.getByRole("button", { name: /^(Tạo bảng|Create board)$/ }).click();

  await expect(page).toHaveURL(/\/w\/[^/]+\/board\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: boardName })).toBeVisible();
}

async function createList(page: Page, title: string) {
  const addListContainer = page.locator("[data-shortcut-add-list-container]").first();
  await addListContainer.getByText("+ Add another list").click();
  await addListContainer.getByPlaceholder(/Enter (list|lane) title\.\.\./).fill(title);
  const boardUrlBeforeSubmit = page.url();
  await addListContainer.getByRole("button", { name: "Add list" }).click();

  const notFoundVisible = await page
    .getByRole("heading", { name: "404" })
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (notFoundVisible) {
    await page.goto(boardUrlBeforeSubmit);
  }

  await expect(listColumn(page, title)).toBeVisible({ timeout: 15_000 });
}

async function addCardToList(page: Page, listTitle: string, cardTitle: string) {
  const column = listColumn(page, listTitle);
  await column.getByText("+ Add a card").click();
  await column.getByPlaceholder("Enter a title for this card...").fill(cardTitle);
  await column.getByRole("button", { name: "Add card" }).click();

  await expect(cardInList(column, cardTitle)).toBeVisible({ timeout: 15_000 });
}

async function dragCardSurfaceToList(page: Page, card: Locator, targetListColumn: Locator) {
  const dropZone = targetListColumn.getByText("Drop card here");
  const hasDropZone = await dropZone.count();

  if (hasDropZone > 0) {
    await dragHandleToTarget(page, card, dropZone);
    return;
  }

  const listScrollBody = targetListColumn.locator(".board-column-scroll").first();
  await dragHandleToTarget(page, card, listScrollBody);
}

async function cardDistribution(page: Page, todoTitle: string, doingTitle: string, cardTitles: string[]) {
  const todoColumn = listColumn(page, todoTitle);
  const doingColumn = listColumn(page, doingTitle);

  let todoCount = 0;
  let doingCount = 0;

  for (const cardTitle of cardTitles) {
    todoCount += await cardInList(todoColumn, cardTitle).count();
    doingCount += await cardInList(doingColumn, cardTitle).count();
  }

  return { doingCount, todoCount };
}

test.describe("DnD immediate reload durability", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run E2E tests.",
  );

  test("rapid multi-card drag survives immediate reload", async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithPassword(page, TEST_EMAIL!, TEST_PASSWORD!);

    const workspaceName = uniqueName("durable-ws");
    const boardName = uniqueName("durable-board");
    const todoList = uniqueName("todo");
    const doingList = uniqueName("doing");
    const cardTitles = [
      uniqueName("card-a"),
      uniqueName("card-b"),
      uniqueName("card-c"),
      uniqueName("card-d"),
    ];

    await createWorkspaceIfAvailable(page, workspaceName);
    await createBoardFromModal(page, boardName);
    await createList(page, todoList);
    await createList(page, doingList);

    for (const cardTitle of cardTitles) {
      await addCardToList(page, todoList, cardTitle);
    }

    const todoColumn = listColumn(page, todoList);
    const doingColumn = listColumn(page, doingList);

    for (const cardTitle of cardTitles) {
      const card = cardInList(todoColumn, cardTitle);
      await dragCardSurfaceToList(page, card, doingColumn);
    }

    await page.reload();

    await expect.poll(async () => {
      await page.reload();
      return cardDistribution(page, todoList, doingList, cardTitles);
    }, {
      timeout: 45_000,
    }).toEqual({
      doingCount: cardTitles.length,
      todoCount: 0,
    });
  });
});
