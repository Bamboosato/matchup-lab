import { expect, test, type Page } from "@playwright/test";

async function registerMembers(page: Page) {
  await page.goto("/members");

 for (let index = 1; index <= 4; index += 1) {
    await page.getByRole("button", { name: "新規追加" }).click();
    const formDialog = page.getByRole("dialog");
    await expect(formDialog).toBeVisible();
    await formDialog.getByRole("textbox", { name: "ニックネーム（表示名）" }).fill(`RouteP${index}`);
    await formDialog.getByRole("textbox", { name: "氏名" }).fill(`Route Player ${index}`);
    await formDialog.getByRole("button", { name: "登録" }).click();
   await expect(page.getByText(`メンバー一覧（${index}/99）`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
 }
}

async function selectAllMembers(page: Page) {
  const contentWidthBefore = await page.evaluate(() => document.body.clientWidth);
  await page.getByRole("button", { name: "メンバー選択" }).click();
  const contentWidthAfter = await page.evaluate(() => document.body.clientWidth);
  expect(contentWidthAfter).toBe(contentWidthBefore);
  const selectionDialog = page.getByRole("dialog", { name: "参加メンバー選択（最大30人）" });
  await expect(selectionDialog).toBeVisible();
  await expect(selectionDialog.locator(".participant-card")).toHaveCount(4);
  await selectionDialog.getByRole("button", { name: "全選択" }).click();
  await expect(page.getByText(/合計: 4 \/ 30/)).toBeVisible();
  await selectionDialog.getByRole("button", { name: "OK" }).click();
  await expect(selectionDialog).toHaveCount(0);
  await expect(page.getByText("選択中").locator("..", { hasText: "4人" })).toBeVisible();
}

async function returnFromMembers(page: Page, format: "doubles" | "singles") {
  await page.getByRole("button", { name: "対戦表" }).click();
  await page.getByRole("menuitem", { name: format === "doubles" ? "ダブルス" : "シングルス" }).click();
  await expect(page).toHaveURL(new RegExp(`/matchups/${format}$`));
}

test("keeps the latest doubles and singles results across member navigation", async ({ page }) => {
  await registerMembers(page);

  await page.goto("/matchups/doubles");
  await page.getByRole("textbox", { name: "開催名" }).fill("Route doubles");
  await page.getByRole("textbox", { name: "コート数" }).fill("1");
  await selectAllMembers(page);
  await page.getByRole("button", { name: "対戦表作成" }).click();
  await expect(page.getByRole("heading", { name: "Route doubles" })).toBeVisible();

  await page.getByRole("link", { name: "メンバー" }).click();
  await expect(page).toHaveURL(/\/members$/);
  await returnFromMembers(page, "doubles");
  await expect(page.getByRole("heading", { name: "Route doubles" })).toBeVisible();

  await page.getByRole("button", { name: "ダブルス" }).click();
  await page.getByRole("menuitem", { name: "シングルス" }).click();
  await expect(page).toHaveURL(/\/matchups\/singles$/);
  await page.getByRole("textbox", { name: "開催名" }).fill("Route singles");
  await selectAllMembers(page);
  await page.getByRole("button", { name: "対戦表作成" }).click();
  await expect(page.getByRole("heading", { name: "Route singles" })).toBeVisible();

  await page.getByRole("link", { name: "メンバー" }).click();
  await expect(page).toHaveURL(/\/members$/);
  await returnFromMembers(page, "singles");
  await expect(page.getByRole("heading", { name: "Route singles" })).toBeVisible();

  await page.getByRole("button", { name: "シングルス" }).click();
  await page.getByRole("menuitem", { name: "ダブルス" }).click();
  await expect(page).toHaveURL(/\/matchups\/doubles$/);
  await expect(page.getByRole("heading", { name: "Route doubles" })).toBeVisible();
});

test("removes deleted members from the selected participant count", async ({ page }) => {
  await registerMembers(page);

  await page.goto("/matchups/doubles");
  await selectAllMembers(page);

  await page.getByRole("button", { name: "ダブルス" }).click();
  await page.getByRole("menuitem", { name: "シングルス" }).click();
  await expect(page).toHaveURL(/\/matchups\/singles$/);
  await selectAllMembers(page);

  await page.getByRole("link", { name: "メンバー" }).click();
  await expect(page).toHaveURL(/\/members$/);

  const routeP1Card = page.getByRole("article").filter({ hasText: "RouteP1" });
  await routeP1Card.hover();
  await routeP1Card.locator(".member-card-menu-trigger").click();
  await routeP1Card.getByRole("menuitem", { name: "削除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "メンバーを削除します" });
  await deleteDialog.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("メンバー一覧（3/99）")).toBeVisible();

  await returnFromMembers(page, "doubles");
  await expect(page.getByText("選択中").locator("..", { hasText: "3人" })).toBeVisible();

  await page.getByRole("button", { name: "ダブルス" }).click();
  await page.getByRole("menuitem", { name: "シングルス" }).click();
  await expect(page).toHaveURL(/\/matchups\/singles$/);
  await expect(page.getByText("選択中").locator("..", { hasText: "3人" })).toBeVisible();
});

test("shows local storage context on the home member card", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-header").getByText("ローカル保存", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "メンバー登録（ローカル保存）" })).toBeVisible();
});

test("keeps the content width stable when the mobile menu locks scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const contentWidthBefore = await page.evaluate(() => document.body.clientWidth);
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByRole("button", { name: "メニューを閉じる" })).toBeVisible();
  const contentWidthAfter = await page.evaluate(() => document.body.clientWidth);

  expect(contentWidthAfter).toBe(contentWidthBefore);
});

test("deletes a member only after confirmation", async ({ page }) => {
  await registerMembers(page);

  const routeP1Card = page.getByRole("article").filter({ hasText: "RouteP1" });
  const routeP1MenuButton = routeP1Card.locator(".member-card-menu-trigger");
  await page.mouse.move(0, 0);
  await expect(routeP1MenuButton).toHaveCSS("opacity", "0");
  await routeP1Card.hover();
  await expect(routeP1MenuButton).toBeVisible();

  await routeP1MenuButton.click();
  await expect(routeP1Card.getByRole("menu")).toBeVisible();
  await expect(routeP1Card.getByRole("menuitem", { name: "編集" })).toBeVisible();
  await expect(routeP1Card.getByRole("menuitem", { name: "削除" })).toBeVisible();

  await routeP1Card.getByRole("menuitem", { name: "削除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "メンバーを削除します" });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText("「RouteP1」を削除します。よろしいですか？");
  await deleteDialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByText("メンバー一覧（4/99）")).toBeVisible();
  await expect(page.getByText("RouteP1", { exact: true })).toBeVisible();

  await routeP1Card.hover();
  await routeP1MenuButton.click();
  await routeP1Card.getByRole("menuitem", { name: "削除" }).click();
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("メンバー一覧（3/99）")).toBeVisible();
  await expect(page.getByText("RouteP1", { exact: true })).toHaveCount(0);
});

test("places member backup actions on their respective panels", async ({ page }) => {
  await page.goto("/members");

  await expect(page.locator(".member-backup-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "復元", exact: true })).toHaveAttribute(
    "title",
    "バックアップからメンバー一覧を復元",
  );
  await expect(page.getByRole("button", { name: "バックアップ", exact: true })).toHaveAttribute(
    "title",
    "メンバー一覧をファイルに保存",
  );
  await expect(page.getByText("並び順", { exact: true })).toHaveCount(0);

  const restoreButton = page.getByRole("button", { name: "復元", exact: true });
  const exportButton = page.getByRole("button", { name: "バックアップ", exact: true });
  await expect(restoreButton).toBeVisible();
  await expect(exportButton).toBeVisible();
  expect(await restoreButton.evaluate((button) => button.closest("section.panel:not(.member-form-panel)") !== null)).toBe(true);
  expect(await exportButton.evaluate((button) => button.closest("section.panel:not(.member-form-panel)") !== null)).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^matchuplab-members-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText(/件のメンバーをバックアップしました。/)).toHaveCount(0);
});
