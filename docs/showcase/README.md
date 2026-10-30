# Recorded showcase — GravityPivot

This is a real local browser recording operated by an AI assistant through Playwright keyboard, pointer and form inputs. No replacement artwork or generated gameplay was used. The README embeds a three-second reduced-resolution GIF excerpt and links the complete silent H.264 recording. The video is re-encoded at 20 fps and 960 pixels wide, with no speed-up, frame reordering or fabricated interaction.

## Provenance

- Application revision: [`6ae1ed64275ae5753ed22bd13afe72897f4122af`](https://github.com/gthgomez/GravityPivot/commit/6ae1ed64275ae5753ed22bd13afe72897f4122af). Only documentation, capture scripts and media are added after that revision.
- Captured: 2026-10-30T12:11:17.646Z on Linux, Chromium 154.0.8037.57, viewport 1280 × 800.
- Evidence class: **DEVELOPER_REVIEWER** (AI-operated capture with source knowledge). This is not a blind playtest, human validation or an in-game AI provider execution.
- Fixture: Fresh local storage; Daily clock fixed to 2026-10-06T12:00:00Z; no debug mode or save mutation.
- [Machine-readable observed capture record](capture.json); [exact input script](../../scripts/capture-showcase.mjs); [encoding script](../../scripts/encode-showcase.sh).
- Eligibility: GitHub API `repos/gthgomez/GravityPivot` reported `fork: false` and no parent on 2026-10-30. Initial history, project documentation and owner copyright were inspected; no external upstream clone was identified. This is an engineering provenance check, not legal clearance.

## Reproduce

Use the committed lockfile and the README's supported Node version. Install Chromium and FFmpeg on the host, or set `CHROMIUM_PATH` to an existing Chromium executable. These shell commands use the same local ports and browser-video cache layout as the recorded run. `SHOWCASE_URL` may override the frontend URL. Run against local development instances only; the scripts create local game state.

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4181 --strictPort
# In a second terminal:
export PLAYWRIGHT_BROWSERS_PATH=../.browsers
npx playwright install ffmpeg
CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-showcase.mjs
bash scripts/encode-showcase.sh
```

A new browser context creates a fresh save/guest every run. Gameplay timings, guest IDs, particles and the browser's rendering can vary; the observed revision and assertions are stored by the capture script. Raw WebM recordings remain ignored and local. Run the encoding script only after a successful capture; it overwrites the derived GIF and MP4.

## What the capture verifies

- canvas visible.
- tether acquired with Space.
- tether released with Space.
- run reset through the visible Reset Run button.
- upgrades opened through UI.

## Verification and limits

`npm run verify` passed: formatting, lint, types, 130 tests, coverage and production build. The full `npm run test:browser` attempt produced 36 Chromium/mobile passes, 2 intended skips and 19 WebKit launch failures because system libraries are missing. A separate desktop/mobile Chromium run passed 36 tests with 2 intended skips. No game source was changed.

The recording is local gameplay, not a deployed service. No Pages workflow or repository setting was changed. The fixed Daily clock is the existing browser-suite fixture, not a live daily score or a qualified record. A fresh isolated browser context supplies empty local storage; the script never writes a save or uses debug mode.

## Media and rights

The images show this repository's own rendered project at the recorded revision. The pre-existing [proprietary license](../../LICENSE), credits and asset notices remain authoritative; this showcase grants no reuse rights and does not republish private source artwork. Screenshot captions describe only what is actually shown. Full-size PNGs are retained for readable labels; the looping GIF is a brief preview, not the whole session.

The capture was repeated after replacing a timing-sensitive keyboard reset with the visible Reset Run button: the keyboard shortcut is intentionally ignored in the crashed phase. Two consecutive captures then completed without page errors. No game implementation change was needed.
