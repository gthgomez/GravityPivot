# GravityPivot — Game Design

## Core loop

Fly through a side-scrolling cave, hold to tether to an anchor, orbit, then release to sling forward. Collect cores for Standard-run progression and skim near the walls to build a combo. A run ends when the ship has no shields left.

The intended mastery is route reading and release timing. Inputs are Space while the playfield is focused, or a primary pointer hold on the playfield. Daily runs choose the nearest anchor regardless of pointer location; Standard runs allow pointer aiming.

## Simulation and world

The engine advances at a fixed 60 Hz. Wall collision uses configurable samples within each tick (default four); core magnet attraction runs once per tick and does not scale with collision precision. The game world is 400 logical units high and renders with a shared uniform transform for drawing and pointer coordinates.

The procedural generator places anchors 250–350 units apart and samples upper/lower wall splines on a 20-unit grid. Chunk continuation keeps anchor and wall frontiers separately. Safety generation enforces ordering, finite bounds, and minimum corridor clearance; these are generation invariants, not a mathematical proof that every route is human-navigable. A reproducible 1,000-seed property set runs in the regular suite; `npm run test:procgen:extended` checks 10,000 seeds and repeated extension/culling.

Near misses are continuous danger-and-escape episodes: entering the danger envelope starts an episode, and leaving it safely rewards `200 × new combo` up to combo five. A collision cancels the episode. Core collection awards `150 × combo`.

Crossing a sector boundary performs a hyper-jump: any tether is released, the ship is placed at the center of the destination corridor, and linear motion resumes at base speed. This prevents the discontinuous world relocation from keeping an old orbit or carrying the ship into a destination wall.

## Standard and Daily rules

Standard runs use the player's saved upgrade levels. Daily runs use UTC `YYYY-MM-DD` identity, rules version 1, a deterministic seed, baseline level-one upgrades, fixed physics settings, and nearest-anchor acquisition. Cosmetics and audio do not alter the challenge. A run keeps the challenge identity captured at launch, including across midnight. Daily records are saved by date and rules version.

Daily is locally comparable gameplay, not a tamper-resistant leaderboard or a promise of bit-identical floating-point results across browsers. Changes to generation, movement, scoring, or input semantics require a Daily rules-version decision.

## Progression and saves

Shield, magnet, and tether upgrades range from level 1 to 10. Upgrade costs use `floor(baseCost × 1.5^(current level − 1))`, with base costs 10, 15, and 20 cores. Core balance, upgrades, top five Standard scores, owned/active skins, sound and motion preferences, and up to 30 Daily dates live in the validated version 7 `gravity_pivot_save` record. Existing `_v6` keys are migrated without deletion; unqualified legacy Daily scores are not promoted into version 1 results.

## Player settings and diagnostics

The header button controls saved sound preference. Motion defaults to the system reduced-motion preference and can be overridden in Settings. Engineering calibration is available only with `?debug=1`; it is unavailable during Daily runs. The exact-zero collinear orbit fallback is always enabled.

## Verification scope

`npm run verify` runs formatting, lint, type checking, unit tests, and the production build. `npm run test:browser` runs production-preview journeys in desktop Chromium, touch-enabled Chromium emulation, and WebKit. Touch emulation and desktop WebKit checks do not constitute physical mobile-device qualification.
