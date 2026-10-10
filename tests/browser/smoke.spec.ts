import { expect, test } from '@playwright/test';

// Daily seeded runs derive their world seed from the current UTC date, so an
// unpinned date turns every Daily-dependent assertion into a lottery: on some
// days' layouts the nearest spawn anchor sits outside R_max and the tether
// legitimately refuses ("Node vector outside tether limits"). Pin the page's
// clock to a date whose layout keeps the spawn anchor tetherable; production
// gameplay stays date-driven because nothing in the app is changed.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
});

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

test('mouse pointer independently acquires and releases a Daily tether', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.locator('#metric-log .mono').last()).toContainText(
    'Tether secure on orbit node',
  );
  await page.mouse.up();
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});

test('Space on a focused launch button keeps native button activation', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#btn-daily-launch').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '0',
  );
  await expect(page.locator('#game-status')).toHaveText(
    'Daily challenge started.',
  );
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
  await expect(page.locator('#hud-personal-best')).toBeHidden();
  await expect(page.locator('#hud-run-cores')).toBeHidden();
  await page
    .getByRole('button', { name: 'Navigate to Upgrades Terminal' })
    .click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');

  await page.getByRole('button', { name: 'Navigate to Cockpit View' }).click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '0');
  await page.locator('#btn-play').click();
  await page.locator('#btn-play').click();
  await expect(page.locator('#hud-personal-best')).toBeVisible();
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
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
  await page.keyboard.up('Space');
  const pausedProgress = await page
    .locator('#sector-hud-bar')
    .getAttribute('style');
  await page.waitForTimeout(250);
  await expect(page.locator('#sector-hud-bar')).toHaveAttribute(
    'style',
    pausedProgress ?? '',
  );

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '1');
  await expect(page.locator('#sector-hud-bar')).toHaveAttribute(
    'style',
    pausedProgress ?? '',
  );
  await page.getByRole('button', { name: 'Resume Flight Control' }).click();
  await expect(page.locator('#pause-overlay')).toHaveCSS('opacity', '0');
  await expect
    .poll(() => page.locator('#sector-hud-bar').getAttribute('style'))
    .not.toBe(pausedProgress);
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
  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.keyboard.up('Space');
});

test('half-width viewport keeps primary controls usable at a 200% zoom equivalent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#btn-play')).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    canvas: document.querySelector('#game-canvas')?.getBoundingClientRect(),
    reset: document.querySelector('#btn-play')?.getBoundingClientRect(),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.canvas?.width).toBeGreaterThan(0);
  expect(layout.reset?.width).toBeGreaterThanOrEqual(44);
  expect(layout.reset?.height).toBeGreaterThanOrEqual(44);
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

test('Daily crash preserves Standard scores and retry starts a fresh run', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The deterministic two-pulse crash route is qualified in desktop Chromium.',
  );
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-01-01T12:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem(
      'gravity_pivot_save',
      JSON.stringify({
        version: 7,
        totalCores: 0,
        upgrades: { shield: 1, magnet: 1, tether: 1 },
        highScores: [{ score: 900, sector: 2, date: '2026-01-01' }],
        skins: { unlockedIds: [0], activeId: 0 },
        preferences: { muted: true, reducedMotion: null },
        dailyRecords: { '2026-01-01@1': 1000000 },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();

  // Advance browser time, including requestAnimationFrame, through the fixed route.
  for (let pulse = 0; pulse < 6; pulse++) {
    if (
      (await page.locator('#game-over-panel').getAttribute('aria-hidden')) ===
      'false'
    ) {
      break;
    }
    await page.keyboard.down('Space');
    await page.clock.runFor(350);
    await page.keyboard.up('Space');
    await page.clock.runFor(500);
  }
  await expect(page.locator('#game-over-panel')).toHaveAttribute(
    'aria-hidden',
    'false',
    { timeout: 10000 },
  );
  const crashedScore = Number(
    await page.locator('#game-over-score').innerText(),
  );
  expect(crashedScore).toBeLessThanOrEqual(1000000);
  await expect(page.locator('#game-over-best')).toHaveText('1000000');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('gravity_pivot_save') ?? '{}'),
  );
  expect(saved.highScores).toEqual([
    { score: 900, sector: 2, date: '2026-01-01' },
  ]);
  expect(saved.dailyRecords).toEqual({ '2026-01-01@1': 1000000 });
  expect(pageErrors).toEqual([]);

  await page.getByRole('button', { name: 'RE-LAUNCH VESSEL' }).click();
  await expect(page.locator('#game-over-panel')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '0',
  );
  await expect(page.locator('#metric-log')).toContainText(
    'Daily challenge 2026-01-01, rules v1.',
  );
});

test('v6 progression migrates once, purchases persist, and refresh restores it', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('gravity_pivot_cores_v6', '100');
    localStorage.setItem('gravity_pivot_shieldLvl_v6', '1');
    localStorage.setItem('gravity_pivot_magnetLvl_v6', '1');
    localStorage.setItem('gravity_pivot_tetherLvl_v6', '1');
    localStorage.setItem('gravity_pivot_unlockedSkins_v6', '[0]');
    localStorage.setItem('gravity_pivot_activeSkinId_v6', '0');
  });
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#shop-cores-count')).toHaveText('100');
  await expect(page.locator('#tab-terminal')).toBeVisible();
  await page.locator('#tab-terminal').click();
  await expect(page.locator('#upg-shield-level')).toHaveText('Lvl 1');
  await page.locator('#buy-shield-btn').click();
  await expect(page.locator('#upg-shield-level')).toHaveText('Lvl 2');
  await page.locator('#buy-skin-btn').click();
  await expect(page.locator('#upg-skin-name')).toHaveText('CYBER PINK');

  const storedBeforeRefresh = await page.evaluate(() => ({
    save: localStorage.getItem('gravity_pivot_save'),
    legacyCores: localStorage.getItem('gravity_pivot_cores_v6'),
  }));
  expect(JSON.parse(storedBeforeRefresh.save ?? '{}').totalCores).toBe(60);
  expect(storedBeforeRefresh.legacyCores).toBe('100');
  await page.reload();
  await page.locator('#tab-terminal').click();
  await expect(page.locator('#shop-cores-count')).toHaveText('60');
  await expect(page.locator('#upg-shield-level')).toHaveText('Lvl 2');
  await expect(page.locator('#upg-skin-name')).toHaveText('CYBER PINK');
  await context.close();
});

test('storage denial does not prevent the app from launching', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith('gravity_pivot_')) throw new Error('storage denied');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('gravity_pivot_')) throw new Error('storage denied');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('http://127.0.0.1:4173/');
  await page
    .getByRole('button', { name: 'Activate Ship Fusion Engines' })
    .click();
  expect(pageErrors).toEqual([]);
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '0',
  );
  await context.close();
});

test('captured pointer release outside the canvas releases the tether', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.mouse.move(8, 8);
  await page.mouse.up();
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});

test('injected pointer cancellation releases safely', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas')!;
    canvas.dispatchEvent(
      new PointerEvent('pointercancel', {
        pointerId: 1,
        isPrimary: true,
        bubbles: true,
        button: 0,
      }),
    );
  });
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
  await page.mouse.up();
});

test('motion and sound settings persist across refresh', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Navigate to Player Settings' })
    .click();
  await page.getByLabel('Motion preference').selectOption('reduced');
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'true',
  );
  await page.locator('#unmute-btn').click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Navigate to Player Settings' })
    .click();
  await expect(page.getByLabel('Motion preference')).toHaveValue('reduced');
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'true',
  );
  await expect(page.locator('#unmute-btn')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('keyboard release does not cancel an independently held pointer', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.keyboard.up('Space');
  await expect(page.locator('#metric-log')).not.toContainText(
    'Tether decoupled.',
  );
  await page.mouse.up();
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});

test('a synthetic secondary pointer cannot steal the primary tether hold', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.locator('#game-canvas').dispatchEvent('pointerdown', {
    pointerId: 2,
    pointerType: 'touch',
    isPrimary: false,
    button: 0,
  });
  await page.mouse.up();
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
});

test('navigating away while held cancels tether before pausing', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('Canvas has no visible bounds');
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page
    .locator('#tab-terminal')
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
  await expect(page.locator('#pause-overlay')).toHaveAttribute(
    'aria-hidden',
    'false',
  );
  await page.mouse.up();
});
