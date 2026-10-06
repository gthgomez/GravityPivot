import { expect, test } from '@playwright/test';

test('loads the production cockpit and launches a run', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/Gravity Pivot/);
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Activate Ship Fusion Engines' }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Activate Ship Fusion Engines' })
    .click();
  expect(pageErrors).toEqual([]);
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '0',
  );
});

test('keyboard tether input acquires and releases an anchor', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.waitForTimeout(350);

  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
    {
      timeout: 5000,
    },
  );
  await page.keyboard.up('Space');
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});

test('touch input acquires and releases an anchor', async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.use.hasTouch,
    'Requires a touch-enabled browser project',
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.waitForTimeout(350);

  const canvas = await page.locator('#game-canvas').boundingBox();
  if (!canvas) throw new Error('Canvas has no visible bounds');

  await page.touchscreen.tap(canvas.x + 250, canvas.y + 200);
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
    {
      timeout: 5000,
    },
  );
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});
