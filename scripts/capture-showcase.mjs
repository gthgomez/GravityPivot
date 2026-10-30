// Run against a local production preview; only normal player controls are used.
import { execFileSync } from 'node:child_process';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const output = 'docs/showcase';
await mkdir(`${output}/raw`, { recursive: true });
await rm(`${output}/capture.json`, { force: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: `${output}/raw`, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  // Same disclosed Daily fixture as the existing browser suite; no debug mode.
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
  await page.goto(process.env.SHOWCASE_URL || 'http://127.0.0.1:4181');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${output}/01-cockpit.png` });
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.keyboard.down('Space');
  await expect(page.locator('#metric-log')).toContainText(
    'Tether secure on orbit node',
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/02-tether.png` });
  await page.keyboard.up('Space');
  await expect(page.locator('#metric-log')).toContainText('Tether decoupled.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/03-sling.png` });
  await page.waitForTimeout(1800);
  // Keyboard R is intentionally ignored after a crash; the normal footer
  // reset works in both flying and crashed phases on slower capture hosts.
  await page.getByRole('button', { name: 'Reset flight path run' }).click();
  await expect(page.locator('#launch-prompt-overlay')).toHaveCSS(
    'opacity',
    '1',
  );
  await page.getByRole('button', { name: 'Activate Daily Seeded Run' }).click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(450);
  await page.keyboard.up('Space');
  await page.waitForTimeout(1700);
  await page
    .getByRole('button', { name: 'Navigate to Upgrades Terminal' })
    .click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${output}/04-upgrades.png` });
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
  await writeFile(
    `${output}/capture.json`,
    JSON.stringify(
      {
        revision: execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim(),
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: { width: 1280, height: 800 },
        pageErrors: errors,
        fixture:
          'Fresh local storage; Daily clock fixed to 2026-10-06T12:00:00Z; no debug mode or save mutation',
        verified: [
          'canvas visible',
          'tether acquired with Space',
          'tether released with Space',
          'run reset through the visible Reset Run button',
          'upgrades opened through UI',
        ],
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), `${output}/raw/session.webm`);
  await browser.close();
}
