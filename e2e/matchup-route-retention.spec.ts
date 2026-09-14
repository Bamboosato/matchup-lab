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

  if ((page.viewportSize()?.width ?? 1280) > 860) {
    const memberList = page.locator(".member-list");
    await expect(memberList.getByRole("columnheader")).toHaveText(["ニックネーム", "氏名", "性別", "備考"]);
    const memberSortSelect = page.locator(".member-list-toolbar select");
    await expect(memberSortSelect.locator("option:checked")).toHaveText("新しい順");
    await memberSortSelect.selectOption("kana");
    await expect(memberSortSelect.locator("option:checked")).toHaveText("ニックネーム");
    await memberSortSelect.selectOption("registered");
    const firstRowCells = await memberList.locator(".member-card").first().locator('[role="cell"]').evaluateAll((elements) =>
      elements.map((element) => element.className),
    );
    expect(firstRowCells).toEqual([
      expect.stringContaining("member-list-nickname"),
      expect.stringContaining("member-list-full-name"),
      expect.stringContaining("participant-gender-badge"),
      expect.stringContaining("member-list-note"),
    ]);
  } else {
    const memberList = page.locator(".member-list");
    await expect(memberList.locator(".member-list-header")).toBeHidden();
    await expect(memberList.locator(".member-card").first().locator(".member-list-note")).toBeVisible();
  }
}

async function selectAllMembers(page: Page, options: { expectCompactGuestCount?: boolean } = {}) {
  const contentWidthBefore = await page.evaluate(() => document.body.clientWidth);
  await page.getByRole("button", { name: "メンバー選択" }).click();
  const contentWidthAfter = await page.evaluate(() => document.body.clientWidth);
  expect(contentWidthAfter).toBe(contentWidthBefore);
  const selectionDialog = page.getByRole("dialog", { name: "参加メンバー選択" });
  await expect(selectionDialog).toBeVisible();
  await expect(selectionDialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const dialogWidth = await selectionDialog.evaluate((element) => element.getBoundingClientRect().width);
  expect(dialogWidth).toBeLessThanOrEqual(480);
  await expect(selectionDialog.locator(".participant-card")).toHaveCount(4);
  const participantBody = selectionDialog.locator(".participant-dropdown-body");
  await expect(participantBody).toHaveCSS("border-bottom-style", "solid");
  await expect(participantBody).toHaveCSS("border-bottom-width", "1px");
  const bodyPaddingRight = await participantBody.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingRight));
  expect(bodyPaddingRight).toBeGreaterThanOrEqual(18);
  await expect(participantBody).toHaveCSS("box-shadow", /3px/);
  await expect(selectionDialog.locator(".participant-selection-bulk-actions")).toBeVisible();
  const selectAllButton = selectionDialog.getByRole("button", { name: "全選択" });
  await expect(selectAllButton).toHaveCSS("text-decoration-line", "none");
  await expect(selectAllButton).toHaveCSS("color", "rgb(29, 78, 216)");
  const title = selectionDialog.locator("#participant-selection-title");
  const total = selectionDialog.locator(".participant-dropdown-title-row .muted");
  await expect(total).toHaveText(
    "合計: 0 / 30人（ゲスト含む）",
  );
  const titleAndTotalPositions = await Promise.all(
    [title, total].map((element) =>
      element.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      }),
    ),
  );
  expect(titleAndTotalPositions[0].left).toBeLessThan(titleAndTotalPositions[1].left);
  expect(titleAndTotalPositions[1].top).toBeLessThanOrEqual(titleAndTotalPositions[0].top + 1);
  const sortModeMenu = selectionDialog.locator(".participant-sort-menu");
  const sortModeTrigger = sortModeMenu.getByRole("button", { name: /並び順/ });
  await sortModeTrigger.click();
  await expect(sortModeMenu.getByRole("menu")).toBeVisible();
  await sortModeMenu.getByRole("menuitemradio", { name: "新しい順" }).click();
  await expect(sortModeTrigger).toHaveText("並び順: 新しい順");
  await sortModeTrigger.click();
  await sortModeMenu.getByRole("menuitemradio", { name: "ニックネーム" }).click();
  await expect(sortModeTrigger).toHaveText("並び順: ニックネーム");
  await expect(sortModeMenu.getByRole("menu")).toHaveCount(0);
  const firstCard = selectionDialog.locator(".participant-card").first();
  await expect(firstCard).toHaveCSS("border-radius", "0px");
  await expect(firstCard.locator(".participant-card-gender")).toHaveClass(/participant-gender-badge/);
  const nicknameColumnRatio = await firstCard.evaluate((element) => {
    const cardStyle = getComputedStyle(element);
    const cardRect = element.getBoundingClientRect();
    const nameRect = element.querySelector<HTMLElement>(".participant-card-name")?.getBoundingClientRect();
    const contentWidth = cardRect.width - Number.parseFloat(cardStyle.paddingLeft) - Number.parseFloat(cardStyle.paddingRight);
    return (nameRect?.width ?? 0) / contentWidth;
  });
  expect(nicknameColumnRatio).toBeGreaterThanOrEqual(0.6);
  expect(nicknameColumnRatio).toBeLessThanOrEqual(0.7);
  const badgeRightGap = await firstCard.evaluate((element) => {
    const cardStyle = getComputedStyle(element);
    const cardRect = element.getBoundingClientRect();
    const badgeRect = element.querySelector<HTMLElement>(".participant-card-gender")?.getBoundingClientRect();
    const contentRight = cardRect.right - Number.parseFloat(cardStyle.paddingRight);
    return contentRight - (badgeRect?.right ?? contentRight);
  });
  expect(badgeRightGap).toBeLessThanOrEqual(1);
  const firstCardChildTags = await firstCard.evaluate((element) =>
    Array.from(element.children).map((child) => child.tagName.toLowerCase()),
  );
  expect(firstCardChildTags).toEqual(["input", "span", "small"]);
  await firstCard.click();
  await expect(firstCard.locator("input")).toBeChecked();
  await firstCard.click();
  await expect(firstCard.locator("input")).not.toBeChecked();
  const guestCountPanel = selectionDialog.locator(".participant-dropdown-body + .participant-guest-count-panel");
  await expect(guestCountPanel).toBeVisible();
  await expect(guestCountPanel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(guestCountPanel).toHaveCSS("border-style", "none");
  const panelWidth = await guestCountPanel.evaluate((element) => element.getBoundingClientRect().width);
  const cardWidth = await selectionDialog.locator(".participant-card").first().evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.abs(panelWidth - cardWidth)).toBeLessThanOrEqual(1);
  const guestTitle = guestCountPanel.locator(".participant-guest-count-title");
  const nicknameLeft = await firstCard.locator(".participant-card-name").evaluate((element) => element.getBoundingClientRect().left);
  const guestTitleLeft = await guestTitle.evaluate((element) => element.getBoundingClientRect().left);
  expect(Math.abs(guestTitleLeft - nicknameLeft)).toBeLessThanOrEqual(1);
  const firstGuestField = guestCountPanel.locator(".count-stepper-field").first();
  const guestTitleCenter = await guestTitle.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  const guestGridCenter = await firstGuestField.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  expect(Math.abs(guestTitleCenter - guestGridCenter)).toBeLessThanOrEqual(1);
  const guestTitleRight = await guestTitle.evaluate((element) => element.getBoundingClientRect().right);
  const guestFieldRects = await guestCountPanel.locator(".count-stepper-field").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }),
  );
  const titleToFemaleGap = (guestFieldRects[0]?.left ?? 0) - guestTitleRight;
  const femaleToMaleGap = (guestFieldRects[1]?.left ?? 0) - (guestFieldRects[0]?.right ?? 0);
  expect(Math.abs(titleToFemaleGap - femaleToMaleGap)).toBeLessThanOrEqual(1);
  expect(Math.max(titleToFemaleGap, femaleToMaleGap)).toBeLessThanOrEqual(40);
  const panelBottom = await guestCountPanel.evaluate((element) => element.getBoundingClientRect().bottom);
  const footerTop = await selectionDialog.locator(".participant-dropdown-actions").evaluate((element) => element.getBoundingClientRect().top);
  expect(footerTop - panelBottom).toBeGreaterThanOrEqual(12);
  const titleFont = await guestTitle.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
  });
  const nicknameFont = await selectionDialog.locator(".participant-card-name strong").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
  });
  expect(titleFont).toEqual(nicknameFont);
  const femaleField = guestCountPanel.locator(".count-stepper-field").first();
  const femaleLabel = femaleField.locator("label");
  const femaleControl = femaleField.locator(".count-stepper-control");
  await expect(femaleLabel).toHaveClass(/count-stepper-label-female/);
  await expect(guestCountPanel.locator(".count-stepper-field").nth(1).locator("label")).toHaveClass(/count-stepper-label-male/);
  const femaleLabelCenter = await femaleLabel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  const femaleControlWidth = await femaleControl.evaluate((element) => element.getBoundingClientRect().width);
  expect(femaleControlWidth).toBeLessThanOrEqual(88);
  const femaleControlCenter = await femaleControl.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  expect(Math.abs(femaleLabelCenter - femaleControlCenter)).toBeLessThanOrEqual(1);
  if (options.expectCompactGuestCount) {
    const guestFieldTops = await guestCountPanel.locator(".count-stepper-field").evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
    expect(Math.abs((guestFieldTops[0] ?? 0) - (guestFieldTops[1] ?? 0))).toBeLessThanOrEqual(1);
  }
  await guestCountPanel.getByRole("button", { name: "追加女性を1人増やす" }).click();
  await expect(guestCountPanel.getByRole("textbox", { name: "女性" })).toHaveValue("1");
  await guestCountPanel.getByRole("button", { name: "追加女性を1人減らす" }).click();
  await expect(guestCountPanel.getByRole("textbox", { name: "女性" })).toHaveValue("0");
  await selectionDialog.getByRole("button", { name: "全選択" }).click();
  await expect(page.getByText("合計: 4 / 30人（ゲスト含む）")).toBeVisible();
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

test("keeps guest count controls compact on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await registerMembers(page);

  await page.goto("/matchups/doubles");
  await selectAllMembers(page, { expectCompactGuestCount: true });
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

  const routeP1Card = page.locator(".member-card").filter({ hasText: "RouteP1" });
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

  const routeP1Card = page.locator(".member-card").filter({ hasText: "RouteP1" });
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

test("keeps member actions in one compact row on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/members");

  const toolbar = page.locator(".member-list-toolbar");
  const sortField = toolbar.locator(".sort-select-field");
  const actions = toolbar.locator(".member-list-actions");
  const actionLabels = ["バックアップ", "復元", "新規追加"];

  await expect(toolbar).toHaveCSS("flex-wrap", "nowrap");
  await expect(actions).toHaveCSS("flex-wrap", "nowrap");
  for (const label of actionLabels) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveAttribute("aria-label", label);
    await expect(button.locator(".member-action-label")).toBeHidden();
    await expect(button).toHaveCSS("width", "36px");
  }

  const toolbarBox = await toolbar.boundingBox();
  const sortBox = await sortField.boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(Math.abs((actionsBox?.y ?? 0) - (sortBox?.y ?? 0))).toBeLessThan(1);
  expect((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0)).toBeLessThanOrEqual(
    (toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0) + 1,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

const memberBackup = {
  schemaVersion: 1,
  appVersion: "1.1.0",
  exportedAt: "2026-08-21T00:00:00.000Z",
  members: [
    {
      id: "backup-member-1",
      nickname: "復元メンバー",
      fullName: "復元 テスト",
      gender: "female",
      note: "バックアップ由来",
      sortKeyKana: "ふくげんめんばー",
      status: "active",
      displayOrder: 1,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  ],
};

async function selectMemberBackup(page: Page) {
  await page.locator("#member-backup-file").setInputFiles({
    name: "matchuplab-members.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(memberBackup)),
  });
}

test("uses an app dialog for member backup restore confirmation", async ({ page }) => {
  let nativeDialogShown = false;
  page.on("dialog", async (dialog) => {
    nativeDialogShown = true;
    await dialog.dismiss();
  });

  await page.goto("/members");
  await selectMemberBackup(page);

  const restoreDialog = page.getByRole("dialog", { name: "メンバーを復元します" });
  await expect(restoreDialog).toBeVisible();
  await expect(restoreDialog).toContainText("MatchupLab");
  await expect(restoreDialog).toContainText("1件のバックアップを復元します。");
  await expect(restoreDialog).toContainText("現在のメンバーデータはバックアップの内容に置き換わります。");

  await restoreDialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(restoreDialog).toHaveCount(0);
  await expect(page.getByText("メンバー未登録です。", { exact: true })).toBeVisible();
  expect(nativeDialogShown).toBe(false);
});

test("restores the selected member backup after app confirmation", async ({ page }) => {
  let nativeDialogShown = false;
  page.on("dialog", async (dialog) => {
    nativeDialogShown = true;
    await dialog.dismiss();
  });

  await page.goto("/members");
  await selectMemberBackup(page);

  const restoreDialog = page.getByRole("dialog", { name: "メンバーを復元します" });
  await restoreDialog.getByRole("button", { name: "復元" }).click();

  await expect(page.getByText("1件のメンバーを復元しました。", { exact: true })).toBeVisible();
  await expect(page.getByText("復元メンバー", { exact: true })).toBeVisible();
  await expect(page.getByText("メンバー一覧（1/99）", { exact: true })).toBeVisible();
  await expect(page.getByText("1件のメンバーを復元しました。", { exact: true })).toHaveCount(0, {
    timeout: 5000,
  });
  expect(nativeDialogShown).toBe(false);
});
