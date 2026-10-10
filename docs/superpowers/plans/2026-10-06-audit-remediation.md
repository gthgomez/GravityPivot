# GravityPivot Audit Remediation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkboxes for tracking. Each numbered delivery is a separate reviewable PR unless explicitly split below.

**Goal:** Make the existing tether and release game correct, fair, browser verified, and enjoyable, while keeping its custom engine and small repository.

**Architecture:** Preserve engine, generator, renderer, UI, audio, and save boundaries. Make run identity and rules explicit, centralize browser lifecycle transitions, and share one coordinate transform between rendering and input. Move result persistence to the composition root before considering further structural changes.

**Tech stack:** Vanilla TypeScript, Canvas 2D, Vite, Vitest; add Playwright for browser journeys and Biome for repository checks.

**Spec:** The user supplied “GravityPivot — Deep Repository, Architecture, Game, and Product Audit,” dated October 6, 2026, targeting `24eb41bbd5f2b9e2b852eda935e6d3e78f1bf671`. Its GP finding IDs are mapped throughout this plan.

## Planning baseline

The original local feature checkout was at `2afa0e8`, while a fresh fetch confirmed `origin/main` is exactly the audited commit. Implementation now uses an isolated worktree from that SHA, which contains the expected root `AGENTS.md`; the old feature checkout remains untouched. Reconcile any unique feature-branch changes before closing the campaign.

Production browser execution also exposed a startup failure not listed in the audit: engine construction reported a fake core collection before the engine binding was initialized, triggering a temporal-dead-zone exception and preventing the launch handlers from being attached. Delivery 2 now includes a regression and removes this reset-as-collection event.

The plan is the only repository change in this planning session. Verification commands below are execution requirements, not reports of passing checks. Live GitHub settings, open work, security features, and branch contents must be read again at execution time.

## Global constraints

- Keep the custom simulation, Canvas 2D, fixed 60 Hz tick, pooled particles, and seeded RNG abstraction.
- Keep one repository instruction authority, at root `AGENTS.md`; preserve applicable existing guards when consolidating it.
- Preserve proprietary licensing, full SHA Action pins, least privilege CI, timeout, and concurrency cancellation.
- Add dependencies only for a concrete need: initially Biome and Playwright. No framework, ECS, backend, event bus, or monorepo migration.
- Use Node 24 as the tested baseline: package engine `>=24 <25`, `.nvmrc` 24, CI 24, README Node.js 24 LTS.
- Fix observed defects before tuning their surrounding mechanics. Do not silently rebalance Standard movement during a correctness fix.
- Preserve existing progression data. Legacy Daily records are unqualified and must not become records for new fair Daily rules.
- Capture evidence per PR: original failure, regression result, repository checks, and browser evidence where applicable.

## Review focus

1. A frame can crash midway through several accumulated ticks: stop immediately and commit its result exactly once. Owned by Deliveries 3 and 5.
2. A sector leap can extend an already generated map: preserve ordered, unique wall samples and valid interpolation. Owned by Delivery 4.
3. A run can cross UTC midnight or experience a tab suspension: retain its original challenge identity and simulation timing. Owned by Delivery 10.
4. A pointer can be cancelled, lose capture, or coexist with another pointer or keyboard press: release safely without an accidental sling or restart. Owned by Delivery 12.
5. Storage can contain a future schema, invalid arrays, or deny writes: keep the game playable and preserve existing stored data. Owned by Delivery 11.

## Execution order and dependencies

| Delivery | Result | Findings | Dependency |
| --- | --- | --- | --- |
| 0 | Reconciled source and reproduction baseline | Audit provenance | None |
| 1 | Canonical checks and truthful Node support | GP-013, GP-017 partly | 0 |
| 2 | Small browser harness | GP-012 | 1 |
| 3 | Standard and Daily results separated | GP-001 | 1; extend 2 |
| 4 | Continuous procedural world | GP-003 | 1 |
| 5 | Reliable pause, resume, reset, and crash transitions | GP-004, GP-007 | 2, 3 |
| 6 | Shared world, render, and input coordinates | GP-005 | 2, 4 |
| 7 | Live particles during flight | GP-006 | 2, 5 |
| 8 | Continuous near-miss episodes | GP-008 | 4, 5 |
| 9 | Magnet independent of collision substeps | GP-009 | 5 |
| 10 | Versioned, comparable Daily runs | GP-002, GP-015, GP-016 partly | 3–9 |
| 11 | Validated saves and explicit persistence ownership | GP-011, GP-016 partly, GP-022 partly | 10 |
| 12 | Pointer lifecycle and accessible player settings | GP-010, GP-015, GP-018 | 6, 10, 11 |
| 13 | Repository safeguards and documentation | GP-014, GP-017, GP-021 | 1, stable 2, 10–12 |
| 14 | Playable portfolio release | GP-020 | 3–13 |
| 15 | Feel, onboarding, geometry progression | GP-019, product recommendations | 14 |
| 16 | Measured performance and staged toolchain updates | GP-022, modernization | 14; rerun after 15 |

Implement sequentially initially. The table expresses technical dependencies; it does not require concurrent agents or a large branch holding all changes.

### Task 0: Delivery 0 — Reconcile and reproduce

**Files:** Read `AGENTS.md` if present, `docs/agent/AGENTS.md` if present, `package.json`, `.nvmrc`, CI, engine, generator, main, and existing tests. Preserve this planning document across any checkout change.

- [x] Read current remote `main`, open PRs/issues, and repository settings; compare current head to the audited head and inspected local head. Do not overwrite a dirty checkout or reuse a stale feature branch for implementation.
- [x] Make a fresh implementation branch from the agreed current base, using an isolated checkout when needed.
- [x] Record which GP findings remain, which are already fixed, and which need browser reproduction. Reproduce the existing gameplay defects on the unmodified build; capture seed, viewport, DPR, and browser where relevant.
- [x] Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` on Node 24. Report actual counts and failures; do not assume exactly 90 tests still exist.

**Gate:** Every P1 has a current reproduction or a documented source condition to exercise. Existing failures have an owner before changes begin.

### Task 1: Delivery 1 — Establish one verification contract

**Modify:** `package.json`, `package-lock.json`, `.nvmrc`, `.github/workflows/ci.yml`, `README.md`, applicable repository instruction file. **Create:** `biome.json`; root `AGENTS.md` only if missing after reconciliation.

- [x] Align Node declarations to the global constraint. Add a pinned compatible Biome release without changing Vite, Vitest, or TypeScript majors.
- [x] Add `format`, `format:check`, `lint`, and `verify`. Define `verify` as format check → lint → typecheck → unit tests → production build. Scope formatting to supported project files and exclude generated assets and outputs.
- [x] Apply only the mechanical formatting needed for the initial gate; clearly identify that diff. If it obscures substantive changes, split formatting into its own PR.
- [x] Make README, root `AGENTS.md`, and CI use `npm run verify`. Retain useful Canvas guards, persistence migration rules, and the prohibition on external engine mutation. Remove stale instruction duplication only after preserving its content.
- [x] Set the CI check display name to `verify`; preserve pinned actions and existing permissions. Run a clean install, `npm run verify`, and preview the production build.

**Gate:** A fresh checkout can reproduce CI with documented commands. Limit this foundation work to one small delivery; tooling must not consume the gameplay campaign.

### Task 2: Delivery 2 — Introduce browser evidence early

**Create:** `playwright.config.ts`, `tests/browser/smoke.spec.ts`. **Modify:** scripts/lockfile, `.gitignore`, CI, README test claims; Vite/Vitest configuration if needed to exclude browser specs from unit discovery.

- [x] Add `@playwright/test` and `test:browser`; serve the built application with `vite preview` on a fixed strict port. Test the production bundle.
- [x] Start with desktop Chromium and a mobile Chromium project with touch enabled. Exercise page load, real Canvas initialization, launch, and tether/release through browser events. Assert no uncaught page errors.
- [x] Add stable observations only where the public UI cannot establish gameplay state. Prefer read-only snapshots; any deterministic fixture injection must be explicitly enabled for testing and absent from the ordinary launch path. Browser tests must operate controls through events rather than invoking engine methods.
- [x] Add a separate CI job named `browser-smoke`, install its browser, build, and run tests. Retain traces/screenshots on failure and exclude outputs from git.
- [x] Rename mocked DOM/WebAudio and direct engine input coverage accurately. Add regressions alongside each following fix; do not require knowingly failing P1 scenarios in CI before their repairs land.

**Gate:** Initial real-browser tests pass and failures provide usable evidence. Touch emulation is not a claim of actual iOS or Android qualification.

### Task 3: Delivery 3 — Separate run results

**Modify:** `src/types.ts`, `src/engine/engine.ts`, `src/main.ts`, `src/state/saveState.ts`, callback fixtures. **Tests:** `tests/engine.test.ts`, `tests/saveState.test.ts`, browser result journey.

**Interfaces:** Introduce `RunContext` as a tagged Standard/Daily union. Standard has `mode: 'STANDARD'`; Daily has `mode: 'DAILY'`, `challengeId: string`, and `rulesVersion: number`. Introduce `RunResult` containing `context`, integer `score`, `sectorReached`, `collectedCores`, and crash `x`/`y`. Use `onRunEnded(result: RunResult): void` for engine result emission. Preserve the legacy Daily identity policy temporarily; Delivery 10 introduces fair rules version 1.

- [x] Add regressions: a Standard crash leaves all Daily fields unchanged; Daily result updates only its own identity; repeated ticks after a crash emit one result and award no additional cores, score, or sectors.
- [x] Store a copy of the context at run initialization. Replace score-saving logic in the engine crash branch with one terminal result event; let `main.ts` record scores and show the resulting best values.
- [x] Standard results enter the Standard leaderboard; Daily results enter Daily records. Existing mixed historical scores remain historical data because their origin cannot be reconstructed reliably.
- [x] Make `physicsTick()` return immediately outside FLYING and after a fatal collision. Update retry and launch to set explicit context. Run targeted tests, `npm run verify`, and the browser result journey.

**Gate:** GP-001 is prevented by run identity, not a mutable UI boolean at crash time.

### Task 4: Delivery 4 — Repair both generation paths

**Modify:** `src/world/generator.ts`, `src/engine/engine.ts`, `src/types.ts`. **Tests:** `tests/generator.test.ts`, `tests/engine.test.ts`; create `tests/properties/generator.test.ts` only if a separate suite improves clarity.

**Interfaces:** Define `GenerationCursor` with independent `lastAnchorX` and `nextWallX` plus monotonic node/core counters. `WorldGenerator.appendSegmentData(map, cursor, count, config, guaranteeGaps, randomFn)` returns the next cursor. The engine owns it and resets it only for a new run. Keep the wall grid at 20 world units.

- [x] Reproduce the constant-0.5 RNG seam. Assert every adjacent anchor gap, including a chunk boundary, is in `[250, 350]`; upper/lower wall arrays align and every wall X advances exactly 20.
- [x] Add regressions for repeated extension, culling, and sector leap extension of an existing map. Wall samples must never restart behind their frontier. Assert unique IDs after culling as well as unique sample X values.
- [x] Replace last-wall-X anchor continuation with the cursor. Use this same extension operation for ordinary travel and sector transitions; generate coverage before moving into a sector destination and preserve any currently tethered anchor until release.
- [x] Check finite coordinates, ordered walls, safe spawn, and core radius clearance inside the corridor and the canonical 400-unit height. Place or reject invalid core candidates without unbounded retries. Enforce minimum corridor clearance 180 world units, the conservative bound from the current 220-unit non-safety envelope minus two 20-unit waves. Preserve the wider safety-mode envelope and test its bounds separately; do not require a full orbital diameter to fit inside the 400-unit viewport. Document these as clearance bounds, not reachability proofs.
- [x] Run a reproducible 1,000-seed property set in normal CI, with seed and append index in failure messages. Add `test:procgen:extended` for 10,000 seeds over multiple extensions/culls, excluded from default unit discovery; run it for this repair and later geometry changes, subject to a measured runtime budget.

**Gate:** Seam, sector, and culling cases satisfy the same structural contract as initial generation. Property checks establish sane geometry; hands-on traversal still decides playability.

### Task 5: Delivery 5 — Centralize lifecycle transitions

**Modify:** `src/main.ts`, `src/engine/engine.ts`, UI as necessary. **Tests:** browser pause/reset/crash journeys; extract `src/gameLifecycle.ts` only if a small pure transition unit makes these behaviors clearer.

**Interfaces:** Use explicit `pauseRun(): void`, `resumeRun(): void`, and `resetToSplash(): void` handlers, independent of `activeTab`. The engine phase remains the simulation authority.

- [x] Reproduce visibility pause while Cockpit remains active; assert Resume returns to FLYING. Assert button reset and `R` reset both stop simulation before showing launch.
- [x] Implement transitions that synchronize phase, overlays, input ownership, audio, and loop timing. Resume selects Cockpit if needed without relying on a tab button click; only PAUSED can resume.
- [x] Reset accumulator and frame timestamp on launch, reset, pause, and resume. In the accumulator loop, recheck phase after each tick and stop when a crash occurs; render the current phase after ticks, not the stale phase read at frame start.
- [x] Keep background return paused until explicit resume. Cover repeated pause/reset actions, navigation during pause, release while hidden, crash/retry, and no hidden-time catch-up.

**Gate:** Every lifecycle entry point has consistent state. Include one actual background/foreground browser exercise where automation supports it; synthetic visibility events prove handler logic only and must be labelled accordingly.

### Task 6: Delivery 6 — Share viewport transforms

**Modify:** `src/constants.ts`, renderer, `main.ts`, `src/ui/uiController.ts`, `src/style.css`; generator constants. **Create:** `src/renderer/viewport.ts`. **Tests:** transform unit cases and browser resize/DPR journey.

**Decision:** Canonical world height is 400. Preserve the generated geometry scale. Use uniform display scaling rather than clipping or stretching the world differently in X and Y.

**Interfaces:** `ViewportTransform` contains logical width/height, CSS scale, DPR, and camera X. Share `clientToWorld(clientX, clientY, rect, viewport)` and `worldToScreen(x, y, viewport)` between input and rendering. For a full canvas rectangle, `scale = rect.height / 400`, `logicalWidth = rect.width / scale`; backing dimensions use CSS dimensions × DPR. The camera ship offset remains 150 world units.

- [x] Add transform round-trip assertions at DPR 1/2/3, after resize, with nonzero canvas page offsets, and near upper/lower world limits. Handle a zero-size hidden canvas by deferring resize/input.
- [x] Apply the shared uniform transform to world drawing; derive overlays/floating text from explicit logical screen coordinates. Preserve existing screen-space HUD and shake scoping rules.
- [x] Replace hard-coded 320/260 logical renderer heights, generator 200 midpoint/390 bounds where constants apply, and duplicated camera/input calculations. CSS controls display size; it does not redefine gameplay height.
- [x] Verify full corridor visibility and clickable anchors at desktop and narrow mobile widths. Report how much forward world space each viewport shows; comparable Daily physics alone does not establish identical visual difficulty.

**Gate:** Rendering and input agree on the same world point across supported sizes and DPR values.

### Task 7: Delivery 7 — Animate particles during play

**Modify:** `src/main.ts`, `src/effects/particles.ts`. **Tests:** `tests/particles.test.ts`, browser flight feedback observation.

- [x] Add a regression that active particles move, lose alpha, expire, and restore pool capacity while FLYING.
- [x] Move particle advancement outside the flight/nonflight branch. Define `ParticleEngine.update(elapsedSeconds = 1 / 60): void` and scale current motion/decay by elapsed × 60 to preserve current 60 Hz behavior across display refresh rates.
- [x] Keep visual time separate from simulation scoring time; pause/game-over particles may finish fading. Clamp visual elapsed after suspension and add `clear(): void` for a new run/reset so old effects do not contaminate the next run.
- [x] Compare equal elapsed time at 30/60/120 render updates in particle unit tests; browser journeys exercise active tether/release and crash feedback.
- [ ] Visually inspect core, near-miss, bounce, and crash feedback during a human play session.

**Gate:** GP-006 is fixed without tying visual randomness or refresh rate to Daily gameplay RNG.

### Task 8: Delivery 8 — Reward continuous near misses

**Modify:** `src/engine/engine.ts`, `src/types.ts`. **Tests:** `tests/engine.test.ts`.

- [x] Reproduce entry into danger in spline cell N followed by safe exit in N+1 and after spline culling. Assert exactly one reward per episode.
- [x] Replace the index set with engine-owned episode state: enter below the configured danger threshold; reward on safe exit at threshold + 5 world units. Retain the existing combo cap of 5 and reward `200 * newCombo`.
- [x] Cancel the episode on collision, crash, reset, or sector teleport. Pause preserves position and cannot award an exit; repeated danger observations cannot accumulate cell records or repeated rewards.
- [x] Emit danger UI changes only when the boolean changes. Verify wall-switching, boundary jitter, collision during danger, and leaving after several cells.

**Gate:** Scoring follows an approach-and-escape episode, with bounded state and no impact bonus.

### Task 9: Delivery 9 — Decouple magnet from collision precision

**Modify:** `src/engine/engine.ts`. **Tests:** `tests/engine.test.ts`.

- [x] Compare core position, collected count, and score after identical fixed ticks with substeps 1, 2, 4, and 8 in a collision-free fixture; include a moving ship and a core crossing the pickup threshold.
- [x] Separate game systems from collision samples. Keep collision sampling in substeps; update magnet attraction once per fixed tick using the final ship state. If pickup needs path coverage, sample pickup separately and ensure each core is collected once.
- [x] Preserve the current default-four-substep pull for a stationary fixture using `alpha = 1 - (1 - p) ** (4 * dt * 60)`, where `p = 0.15 * (1 - distance / activeMagnetRange)`. Document the intentional moving-path approximation; real-player collection feel remains part of the playtest campaign.
- [x] Verify equivalence across collision substep counts, zero-distance behavior, and nonfinite input guards. Do not claim identical collision outcomes where different sampling legitimately detects different collisions.

**Gate:** Collision precision changes no longer multiply attraction strength or reward events. Arbitrary timestep equivalence is a separate numerical claim; the supported simulation tick stays 1/60.

### Task 10: Delivery 10 — Ship Daily rules version 1

**Create:** `src/engine/runRules.ts`, `docs/DAILY_CHALLENGE.md`, `tests/runRules.test.ts`. **Modify:** engine, main, types, save adapter, UI; tests and browser Daily journeys.

**Decision:** Daily is a common seeded challenge with baseline level-1 shield/magnet/tether, fixed default physics, safety gaps enabled, collinear protection enabled, and substeps 4. Standard retains owned progression. Daily skins, audio, and reduced motion remain cosmetic. Daily rewards may earn cores, but purchases cannot change the active Daily ship.

**Interfaces:** `createDailyContext(now: Date): RunContext` captures `now.toISOString().slice(0, 10)` and `rulesVersion: 1`. `resolveRunRules(context, upgrades): RunRules` returns copied rules and effective upgrade levels. Freeze these effective values for the run. Derive the numeric RNG seed with a documented stable 32-bit hash of `gravitypivot|1|YYYY-MM-DD`; add golden fixtures for a known date.

- [x] Assert same UTC date/rules version produces identical context, rules, initial map, and extension map despite timezone, upgrade ownership, screen size, local calibration, and cosmetics.
- [x] Canonical Daily acquisition uses nearest-anchor selection for keyboard, mouse, and touch. Pointer aim remains a Standard feature. Equal-distance ties use stable generated IDs, and player copy explains Daily auto selection.
- [x] Keep gameplay RNG independent of particles/stars and generation independent of viewport. Use simulation elapsed time for sector cooldown; preserve the 2-second cooldown and test suspension between sector crossings.
- [x] Lock rule mutations in Daily at engine boundaries, including `syncUpgrades`, sliders, and calibration updates. Add validated configuration setters and return copied configuration from `getConfig()`.
- [x] Save Daily results by captured `(challengeId, rulesVersion)` through midnight. A retry uses the current UTC day. Read the current challenge best before launch.
- [x] Treat legacy contaminated Daily bests as unqualified, preserve their source data, and start version-1 records separately. An older day's in-flight completion cannot replace a newer day's best.
- [x] Extend browser tests with multiple timezones and different saved upgrades; add replay assertions comparing physics under identical tick inputs. Document local comparability limits.

**Gate:** “Daily” has a documented, enforced, versioned meaning. Any later generation, physics, scoring, or input change affecting Daily requires a rules-version decision.

### Task 11: Delivery 11 — Migrate persistence safely

**Modify:** `src/state/saveState.ts`, engine/main/types, save tests. **Create:** `src/state/saveSchema.ts` if validation warrants a focused file; browser refresh/migration journey.

**Decision:** One `gravity_pivot_save` JSON blob with `version: 7`, validated progression, top-five Standard scores, skin ID ownership, preferences, and Daily records keyed by `challengeId@rulesVersion`. Retain the most recent 30 distinct challenge days, including in-flight results; retain legacy keys during the first migration.

- [x] Add fixtures for valid legacy v6, missing keys, malformed JSON, negative/nonfinite/fractional values, invalid score objects, duplicate/unknown skin IDs, unowned active skin, failed storage access/write, and an unsupported future version.
- [x] Validate finite nonnegative integer balances/scores, upgrade levels 1–10, score entries, known distinct skin IDs including 0, and owned active skin. Preserve valid fields while repairing invalid fields. Future-version data is read-only: do not overwrite or reinterpret it as v6.
- [x] Load current blob first; only if absent migrate legacy keys in memory, validate, and write the complete value once. A failed write leaves source keys intact and gameplay usable. Preserve corrupt current data in a backup before replacing it; if backup fails, use repaired values in memory without destructive repair.
- [x] Remove engine dependence on `GameSaveState`: pass effective upgrades and rules into initialization, keep run rewards as engine state, and emit typed collection/results events. The composition root records progression exactly once. Typed purchase/equip methods enforce cost, caps, and ownership.
- [x] Persist core accrual on its current reliable schedule; batching was not justified by Delivery 16 measurements.
- [x] Verify migration, purchase, equip, Daily identity, refresh, and storage denial through tests and the browser. Expose readonly render views with readonly nested arrays/items; use explicit diagnostic copies for tests and durable snapshots. Do not copy or deep-freeze the full world every frame.

**Gate:** Existing balances/upgrades/skins survive; invalid data cannot break launch, UI, or purchases; future saves remain untouched. The engine no longer performs storage writes.

### Task 12: Delivery 12 — Unify input and improve surrounding UI

Split into two PRs if pointer and accessibility review become substantial. **Modify:** main, UI, renderer effects, audio settings as necessary, HTML/CSS, save preferences; browser input/accessibility journeys.

- [x] Use Pointer Events with one owned primary pointer and capture on press. Apply `touch-action: none` to the playfield. Handle `pointerup`, `pointercancel`, `lostpointercapture`, blur, visibility pause, and reset through one release path; ignore secondary/nonprimary presses.
- [x] Track keyboard and pointer ownership together so a stale keyup or a second device cannot release another held action. Space is gameplay input only when the playfield is active; focused buttons, text inputs, and sliders retain their normal keyboard behavior.
- [x] Add browser cases for dragging/releasing outside Canvas, injected cancellation, secondary contact, mixed input, pause while held, post-resize aiming, and real tap/hold/release wiring. Injected cancellation is labelled separately from actual system interruption testing.
- [x] Move engineering calibration behind `?debug=1` and keep it locked during Daily. Remove “Fix #” and navigability claims from ordinary player UI; retain a deterministic exact-zero collinear fallback as an invariant.
- [x] Add player settings for sound and motion. Default to system reduced-motion preference and allow an explicit override; suppress shake and large transitions and reduce decorative particles without weakening essential tether/collision signals.
- [x] Provide visible focus, correct tab selection semantics, labelled controls, and pause/game-over focus entry/restoration. Keep essential flight text at least 14 CSS px and primary touch controls at least 44×44 CSS px. Avoid continuous score announcements; announce launch/pause/crash state changes where useful.
- [x] Check keyboard-only launch → playfield → pause → resume → crash → retry, narrow viewports, mute persistence, and reduced motion. Add WebKit browser journeys.
- [x] Exercise a 200% zoom-equivalent half-width viewport in Chromium, mobile Chromium emulation, and WebKit; retain the full world view and primary control sizing.
- [ ] Check actual browser zoom and perform one actual mobile-device play session before claiming mobile qualification.

**Gate:** Inputs have a cancellation policy; player controls communicate player choices; keyboard focus and motion preferences work through complete journeys.

### Task 13: Delivery 13 — Apply small repository safeguards

**Create/modify:** `.github/dependabot.yml`, optional PR template, README, GDD, SECURITY, root AGENTS, CI only as necessary; live GitHub repository settings.

- [x] Recheck open issues/PRs and compare the stale branch tree. No backlog items were created because that writes to GitHub; `ci/github-actions` has no unique tree differences but remains undeleted.
- [x] Add grouped weekly npm updates and GitHub Actions update handling that preserves full SHA pins.
- [x] Observe successful PR checks named `verify` and `browser-smoke` on draft PR #4.
- [ ] Configure a `main` ruleset with zero required approvals, PRs, conversation resolution, no force pushes/deletion, and an admin bypass.
- [ ] Enable available Dependabot/security, secret scanning/push protection, and optionally CodeQL; verify actual remote state.
- [x] Correct SECURITY wording: vulnerability status does not depend on license; keep reporting terms consistent with the stated support policy.
- [x] Reconcile GDD with max upgrades 10, shared exponential costs, 2–4 generated cores, actual run rules, controls, and testing scope; measured coverage floors are enforced.
- [ ] Archive/delete the obsolete `ci/github-actions` remote branch only after owner authorization.

**Gate:** Required checks match real CI, settings are read back, and documentation matches delivered behavior. Remote deletion and settings changes require execution scope from the owner; prepare concrete values before any needed approval.

### Task 14: Delivery 14 — Release a truthful playable demo

**Modify:** README, HTML title, repo homepage; deploy config/workflow appropriate to the selected host. Add one actual gameplay screenshot or short GIF.

- [x] Remove “Production-Ready” and unsupported browser/touch claims; state proven coverage and remaining device limits precisely.
- [x] Select GitHub Pages as a static host and validate repository base path, build assets, preview routing, and audio activation behavior in local production browser runs.
- [ ] Publish and update the repository homepage only after the owner authorizes the prepared Pages workflow; no deployed URL is claimed.
- [x] Structure README around the mechanic, concise controls, architecture, exact developer checks, and a real gameplay screenshot. A Play URL is labeled as prepared, not live.
- [ ] Run deployed desktop/mobile browser journeys and manual release playtest, including background/resume, repeated retry, and a sector boundary; retain a known-build rollback.

**Gate:** A visitor can open the game, understand hold/orbit/release, play, and find accurate engineering evidence. No deployment claim precedes a working URL.

### Task 15: Delivery 15 — Improve mastery and feel

This is a measured design campaign after correctness, delivered in at least two PRs. **Modify:** renderer/audio/UI/HTML/CSS for feel; generator/rules for difficulty; update GDD and Daily version when necessary.

- [ ] Observe five short first-time play sessions where practical. Record time to first intentional tether/release, pause/retry confusion, cause-of-death understanding, and whether players choose to retry. Obtain actual observations before claiming fun or fairness scores improved.
- [x] Build an easy opening demonstration with “HOLD to tether” and “RELEASE to sling.” Teach near-miss combo only after the basic mechanic is understood. Avoid a pregame manual.
- [x] Give acquisition, orbital tension, release, near miss, and impact distinguishable cues. Reduce cockpit competition with score/combo/shield/sector; preserve the visual identity and reduced-motion behavior.
- [ ] Add a capped geometry schedule through a `DifficultyProfile`: clearance, vertical displacement, and route patterns. Approve concrete parameter bounds from the traversal/playtest baseline before coding the curve; keep core movement speed stable initially.
- [x] Reuse property tests, extended seed checks, and browser journeys. No headless traversal policy was added because no demonstrated impossible or boring seeds remain; structural invariants are not a human playability proof.
- [ ] Reevaluate five short sessions against the baseline. Record remaining collision/readability concerns and tune one parameter family at a time. New scalar/play-style upgrades, skins, and additional modes follow demonstrated improvement in the core loop.

**Gate:** Players can learn and recover, spatial challenge progresses inside safety bounds, and release feedback supports deliberate decisions. Changes that affect Daily get a new rules version or explicitly wait for a challenge boundary.

### Task 16: Delivery 16 — Measure, then modernize

**Modify:** only the subsystem supported by measurements or the specific toolchain migration. Each major upgrade gets its own PR.

- [ ] Profile repeated runs on representative physical desktop and mobile devices. The local headless/emulated baseline and deterministic engine stress profile are recorded in `docs/PERFORMANCE_PROFILE.md`; repeat measurements on named physical devices before claiming the provisional p95 target.
- [x] Optimize only measured contributors. Equality guards removed repeated telemetry and sector-label writes; storage batching, nearest-node indexing, and allocation changes were not justified by current measurements. A run-end-only save policy was not introduced.
- [x] Establish meaningful coverage for engine/generator/save logic. V8 coverage floors were set after reviewing the baseline and uncovered defensive/exceptional paths: 80% statements/functions/lines and 70% branches.
- [x] Check official release notes and compatibility at execution time. Vitest, Vite, and TypeScript were upgraded as separately reviewable commits, selecting current compatible versions.
- [x] For each candidate run clean install, `npm run verify`, `npm run test:browser`, local deployed-path preview, and compare build output and startup. Stop further upgrading when there is no demonstrated maintenance or compatibility benefit.

**Gate:** Performance claims identify device and workload; every toolchain migration retains browser and deterministic gameplay behavior.

## Completion evidence

For each PR, keep a brief problem → behavior change → verification → material limitation description. Reproduce the original failure before the fix, then show the same scenario passing. Run targeted regressions while developing and the full canonical checks before handing off the PR. Run browser checks when wiring, input, rendering, saves, or lifecycle changes.

| Milestone | Required evidence |
| --- | --- |
| Correct game | All P1 findings addressed; seeded seams/sector extension tests; lifecycle and input-coordinate browser regressions; actual playable smoke |
| Fair Daily | UTC/versioned identity; upgrade/config/input normalization; midnight and simulation-clock regressions; identical-input replay comparison |
| Durable product | Migration fixtures; storage failure/future-schema preservation; refresh journey; pointer cancellation; keyboard/motion/device observations |
| Portfolio release | Working deployed URL; truthful README visual/claims; passing required CI; settings readback; documented manual playtest |
| Improved game | First-time observations, capped geometry curve, clear release feedback, measured performance and remaining limitations |

The first implementation action is Delivery 0, followed by the small verification PR and browser harness. The campaign is complete when the existing game meets these gates; extra features and major upgrades are optional follow-on work, not prerequisites for calling the repair campaign successful.

## Reference checks for execution

- Node 24 is listed as LTS in the official [Node release table](https://nodejs.org/en/about/previous-releases). Use the project's chosen support contract rather than chasing the newest runtime.
- Playwright documents viewport, touch, DPR/device, and timezone emulation in its [emulation guide](https://playwright.dev/docs/emulation). Emulation covers browser configuration and does not replace device observations.
- Consult the current official [Vite migration guide](https://vite.dev/guide/migration) for build-system changes when the modernization PR begins.
