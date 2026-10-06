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

test('pause, navigation, resume, and reset use consistent run transitions', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Activate Ship Fusion Engines' })
    .click();
  await page
    .getByRole('button', { name: 'Navigate to Upgrades Terminal' })
    .click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');

  await page.getByRole('button', { name: 'Navigate to Cockpit View' }).click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '0');
  await page.locator('#btn-play').click();
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(page.locator('#hud-score')).toHaveText('00000');
  await page.waitForTimeout(200);
  await expect(page.locator('#hud-score')).toHaveText('00000');

  await page
    .getByRole('button', { name: 'Activate Ship Fusion Engines' })
    .click();
  await page.keyboard.press('KeyR');
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(page.locator('#hud-score')).toHaveText('00000');
});

test('synthetic visibility events pause and resume only on explicit action', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Activate Ship Fusion Engines' })
    .click();

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Resume Flight Control' }).click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '0');
});

test('resized canvas keeps the full 400-unit world at its current DPR', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const viewport = await page.locator('#game-canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const rect = element.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      dpr: window.devicePixelRatio,
      backingWidth: element.width,
      backingHeight: element.height,
    };
  });
  expect(viewport.backingWidth).toBe(
    Math.round(viewport.cssWidth * viewport.dpr),
  );
  expect(viewport.backingHeight).toBe(
    Math.round(viewport.cssHeight * viewport.dpr),
  );
  expect(viewport.cssHeight).toBe(300);

  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.waitForTimeout(250);
  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.keyboard.up('Space');
});

test('Daily identity is common across timezones and owned upgrades', async ({
  browser,
}) => {
  const observations: Array<{ challenge: string; best: string }> = [];
  for (const [timezoneId, upgrades] of [
    ['Pacific/Honolulu', ['1', '1', '1']],
    ['Asia/Tokyo', ['10', '9', '8']],
  ] as const) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.addInitScript(
      (levels) => {
        localStorage.setItem('gravity_pivot_shieldLvl_v6', levels[0]);
        localStorage.setItem('gravity_pivot_magnetLvl_v6', levels[1]);
        localStorage.setItem('gravity_pivot_tetherLvl_v6', levels[2]);
        localStorage.setItem('gravity_pivot_dailyBest_v6', '999');
        localStorage.setItem(
          'gravity_pivot_dailyBestDate_v6',
          new Date().toDateString(),
        );
      },
      [...upgrades],
    );
    await page.goto('http://127.0.0.1:4173/');
    await page
      .getByRole('button', { name: 'Activate Daily Seeded Run' })
      .click();
    const logText = await page.locator('#metric-log').innerText();
    const challenge = logText.match(
      /Daily challenge \d{4}-\d{2}-\d{2}, rules v\d+\. Tether auto-selects the nearest anchor\./,
    )?.[0];
    const best = await page.locator('#hud-personal-best').innerText();
    observations.push({ challenge: challenge ?? '', best });
    await context.close();
  }

  expect(observations[0].challenge).toMatch(/^Daily challenge/);
  expect(observations[0].challenge).toBe(observations[1].challenge);
  expect(observations.map(({ best }) => best)).toEqual(['00000', '00000']);
});
