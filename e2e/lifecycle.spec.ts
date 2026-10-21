import { test, expect, type Page } from "@playwright/test";
const password = process.env.DEMO_PASSWORD;
if (!password)
  throw new Error(
    "DEMO_PASSWORD is required for E2E. Seed an isolated demo database first.",
  );
async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page
    .getByLabel("電子郵件", { exact: true })
    .fill(`${role}@assetflow.local`);
  await page.getByLabel("密碼", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "登入 AssetFlow" }).click();
  await expect(
    page.getByRole("heading", { name: "讓每一項資產，流轉有序." }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "開啟導覽" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "主導覽" })
    .getByRole("link", { name, exact: true })
    .click();
}
test("未登入與 Viewer 權限、刷新、登出", async ({ page }) => {
  await page.goto("/assets");
  await expect(page).toHaveURL(/login/);
  await login(page, "viewer");
  await nav(page, "資產管理");
  await expect(
    page.getByRole("button", { name: "新增資產", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.goto("/users");
  await expect(page).toHaveURL("http://localhost:5173/");
  const menu = page.getByRole("button", { name: "開啟導覽" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
test("真實完整流程：資產、員工、領用、交接阻擋、故障歸還、維修與結案", async ({
  page,
}, info) => {
  const unique = `${info.project.name}-${Date.now()}`,
    tag = `E2E-${unique}`.toUpperCase(),
    employeeName = `測試員工 ${unique}`;
  await login(page);
  await nav(page, "員工目錄");
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "建立員工", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("員工編號").fill(`E-${unique}`);
  await dialog.getByRole("textbox", { name: "姓名", exact: true }).fill(employeeName);
  await dialog.getByLabel("部門").selectOption({ index: 1 });
  await dialog.getByLabel("職稱").fill("測試工程師");
  await dialog.getByLabel("電子郵件").fill(`${unique}@example.test`);
  await dialog.getByRole("button", { name: "建立員工", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "資產管理");
  await page.getByRole("button", { name: "新增資產", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("資產編號").fill(tag);
  await dialog.getByLabel("資產名稱").fill(`展示筆電 ${unique}`);
  await dialog.getByRole("combobox", { name: "分類", exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("存放位置").fill("測試辦公室");
  await dialog.getByRole("textbox", { name: "品牌", exact: true }).fill("Test");
  await dialog.getByLabel("型號").fill("Lifecycle Pro");
  await dialog.getByRole("button", { name: "建立資產", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("搜尋資產", { exact: true }).fill(tag);
  await page
    .getByRole("link", { name: new RegExp(`展示筆電 ${unique}`) })
    .click();
  await expect(
    page.getByRole("heading", { name: `展示筆電 ${unique}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "領用設備", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("搜尋在職員工選項").fill(employeeName);
  await expect(dialog.getByLabel("領用員工").locator("option")).toHaveCount(2);
  await dialog.getByLabel("領用員工").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "確認領用" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "歸還設備", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "歸還設備", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: `${employeeName} ↗`, exact: true })
    .click();
  await page.getByRole("button", { name: "啟動離職交接", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("預計離職日期").fill("2027-12-31");
  await dialog.getByRole("button", { name: "啟動交接", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "離職交接");
  await page.getByLabel("搜尋交接員工").fill(employeeName);
  const card = page
    .locator(".offboarding-card")
    .filter({ hasText: employeeName });
  await expect(
    card.getByRole("button", { name: "完成交接", exact: true }),
  ).toBeDisabled();
  await card.getByRole("button", { name: "歸還設備", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("設備狀況").selectOption("DAMAGED");
  await dialog.getByRole("button", { name: "確認歸還" }).click();
  await expect(dialog.getByRole("alert")).toContainText("故障描述");
  await dialog.getByLabel("故障描述").fill("顯示器無法正常開啟");
  await dialog.getByRole("button", { name: "確認歸還" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    card.getByRole("button", { name: "完成交接", exact: true }),
  ).toBeEnabled();
  await card.getByRole("button", { name: "完成交接", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "完成交接", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("離職交接已完成");
  await nav(page, "維修工作台");
  await page.getByLabel("搜尋維修").fill(unique);
  const maintenance = page
    .locator(".maintenance-card")
    .filter({ hasText: unique });
  await maintenance.getByRole("button", { name: "更新進度" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("維修進度").fill("已更換螢幕，驗收中");
  await dialog.getByRole("button", { name: "儲存變更" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(maintenance).toContainText("已更換螢幕");
  await maintenance.getByRole("button", { name: "完成維修" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("設備處理結果").selectOption("AVAILABLE");
  await dialog.getByRole("button", { name: "確認結案" }).click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "資產管理");
  await page.getByLabel("搜尋資產", { exact: true }).fill(tag);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("可借出");
  await nav(page, "操作紀錄");
  await page.getByLabel("搜尋操作紀錄").fill("MAINTENANCE_COMPLETED");
  await expect(page.locator("tbody tr").first()).toContainText("維修結案");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
