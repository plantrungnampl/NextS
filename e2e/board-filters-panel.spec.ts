import { expect, test, type Locator, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function listColumn(page: Page, listTitle: string): Locator {
  return page.locator("[data-lane-pan-stop]").filter({
    has: page.getByRole("button", { exact: true, name: listTitle }),
    has: page.getByRole("button", { name: "Move list" }),
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
  if (hasWorkspaceInput < 1) {
    return;
  }

  const isVisible = await workspaceNameInput.first().isVisible().catch(() => false);
  if (!isVisible) {
    return;
  }

  await workspaceNameInput.fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/w$/);
}

async function createBoardFromModal(page: Page, boardName: string) {
  const createNewButton = page.getByRole("button", { name: /Create new|Tạo mới/i }).first();
  if (await createNewButton.count()) {
    await createNewButton.click();
  } else {
    await page.getByRole("link", { name: /Create new|Tạo mới/i }).first().click();
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
  await addListContainer.getByRole("button", { name: "Add list" }).click();
  await expect(listColumn(page, title)).toBeVisible({ timeout: 15_000 });
}

async function addCardToList(page: Page, listTitle: string, cardTitle: string) {
  const column = listColumn(page, listTitle);
  await column.getByText("+ Add a card").click();
  await column.getByPlaceholder("Enter a title for this card...").fill(cardTitle);
  await column.getByRole("button", { name: "Add card" }).click();
  await expect(cardInList(column, cardTitle)).toBeVisible({ timeout: 15_000 });
}

test.describe("Board filters panel", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run E2E tests.",
  );

  test("opens filter panel, applies keyword filter, persists via URL after reload", async ({ page }) => {
    test.setTimeout(120_000);

    await loginWithPassword(page, TEST_EMAIL!, TEST_PASSWORD!);

    const workspaceName = uniqueName("filters-ws");
    const boardName = uniqueName("filters-board");
    const listName = uniqueName("filters-list");
    const matchingCard = uniqueName("keyword-hit");
    const hiddenCard = uniqueName("keyword-miss");

    await createWorkspaceIfAvailable(page, workspaceName);
    await createBoardFromModal(page, boardName);
    await createList(page, listName);
    await addCardToList(page, listName, matchingCard);
    await addCardToList(page, listName, hiddenCard);

    await page.getByRole("button", { name: "Board filters" }).click();
    await expect(page.getByText("Lọc")).toBeVisible();

    const keywordInput = page.getByPlaceholder("Nhập từ khóa...");
    await keywordInput.fill("hit");
    await expect.poll(() => new URL(page.url()).searchParams.get("bf_q")).toBe("hit");

    const targetColumn = listColumn(page, listName);
    await expect(cardInList(targetColumn, matchingCard)).toBeVisible();
    await expect(cardInList(targetColumn, hiddenCard)).toHaveCount(0);

    await page.reload();
    await expect.poll(() => new URL(page.url()).searchParams.get("bf_q")).toBe("hit");
    await expect(cardInList(listColumn(page, listName), matchingCard)).toBeVisible();
    await expect(cardInList(listColumn(page, listName), hiddenCard)).toHaveCount(0);
  });
});
