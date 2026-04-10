const { test, expect } = require('@playwright/test');

test.describe('Landing smoke', () => {
  test('home page loads Mana Mingle', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Mana Mingle').first()).toBeVisible({ timeout: 20000 });
  });
});
