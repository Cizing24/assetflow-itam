import 'dotenv/config';
import { chromium, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
if (process.env.DEMO_SEED !== 'true' || !process.env.DEMO_PASSWORD) throw new Error('Use an isolated demo environment with DEMO_SEED and DEMO_PASSWORD.');
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  for (const mode of ['desktop', 'mobile'] as const) {
    const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7'] } : { viewport: { width: 1512, height: 1040 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://localhost:5173/login');
    if (mode === 'desktop') await page.screenshot({ path: 'docs/screenshots/login.png' });
    await page.getByLabel('電子郵件', { exact: true }).fill('admin@assetflow.local');
    await page.getByLabel('密碼', { exact: true }).fill(process.env.DEMO_PASSWORD);
    await page.getByRole('button', { name: '登入 AssetFlow' }).click();
    await expect(page.locator('.metric-value')).toHaveCount(4);
    await page.screenshot({ path: `docs/screenshots/dashboard-${mode}.png`, fullPage: true });
    if (mode === 'desktop') {
      await page.goto('http://localhost:5173/assets'); await expect(page.locator('tbody tr').first()).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/assets.png' });
      await page.goto('http://localhost:5173/offboarding'); await expect(page.locator('.offboarding-card').first()).toBeVisible(); await page.screenshot({ path: 'docs/screenshots/offboarding.png' });
    }
    await context.close();
  }
} finally { await browser.close(); }
console.log('Captured real API-backed demo screens in docs/screenshots.');
