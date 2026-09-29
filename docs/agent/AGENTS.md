# AGENTS.md — GravityPivot

> Inherits from `C:\Workspace\Project_Games\AGENTS.md` and `CLAUDE.md`.
> This file covers canvas-engine–specific guardrails for the GravityPivot project only.

## Stack
- **Runtime**: Vite + TypeScript (browser, no framework)
- **Renderer**: HTML5 Canvas 2D (`CanvasRenderingContext2D`)
- **Physics**: Custom fixed-step accumulator loop (60fps target, `physicsTimeStep = 1/60`)
- **Tests**: Vitest — `npm run test`
- **Type check**: `npm run typecheck` (`tsc --noEmit`)

## Verification Gates
Never mark work complete without running both:
```
npm run typecheck   # must be 0 errors
npm run test        # all suites must pass
```

---

## Canvas Game Patterns

### 1. Camera Transform Scope
All world-space drawing happens inside a single `ctx.save() / ctx.translate(cameraX, 0) / ctx.restore()` block. Screen-space elements (HUD overlays, crash panels, floating score texts) must render **after** `ctx.restore()`.

> ❌ Never draw overlay content inside the camera transform — it will scroll with the world.

### 2. Screen Shake Placement
Shake offsets are added **inside** the camera translate call, not outside it:
```ts
// ✅ Correct — overlays rendered after restore() stay stable
ctx.translate(cameraOffsetX + shakeX, shakeY);
this.shakeIntensity *= 0.85; // exponential decay each frame
```
Placing shake outside the `ctx.save()` block will shake HUD elements and DOM overlays along with the world.

### 3. Floating Score Texts — Screen Space Only
Convert world-position events to screen coordinates at spawn time:
```ts
// worldX → screenX conversion before spawning
renderer.spawnFloatingText(worldX + cameraOffsetX, worldY, '+150', '#fbbf24');
```
Spawning in world space causes text to scroll off the left edge in ~25 frames at default `baseSpeed`.

### 4. Trail Reset on Coordinate Teleports
Whenever the spark position teleports (sector leap, `initializeLevel()`), immediately truncate the trail ring buffer to length 1 or zero it out. Skipping this draws a line from the old position to the new one across thousands of pixels.

### 5. Wall Bounce Velocity Recovery
After a wall collision resolves (shield damage absorbed), always restore positive forward velocity before releasing physics:
```ts
spark.vx = config.baseSpeed;
spark.vy = 0;
```
Leaving `vx` negative after a bounce locks the player in a reverse-flight loop that clips through the left culling boundary.

### 6. Unlock Data Models — ID Arrays, Not Counters
```ts
unlockedSkins: number[]    // ✅ player can own IDs [0, 2] without owning 1
unlockedSkinsCount: number // ❌ forces sequential unlock; breaks on skin reordering
```
Store which items are owned by ID. Store which item is active by ID. Never derive ownership from position.

### 7. Shared Cost Formulas — Single Source of Truth
Define upgrade cost functions once in `constants.ts` and import everywhere:
```ts
export function upgradeCost(baseCost: number, currentLevel: number): number {
  return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
}
```
Duplicating this formula across `main.ts` and `uiController.ts` causes the displayed price and actual deduction to diverge silently.

### 8. Engine State — No External Mutation via `as any`
The engine's internal spark state must only be modified through the engine's own methods (`physicsTick`, `initializeLevel`, `syncUpgrades`). Casting `getSparkState() as any` and writing properties directly from `main.ts` bypasses consistency guards and creates invisible state divergence. Test files are the only legitimate exception.

---

## Blast Radius
| Zone | Risk | Note |
|------|------|------|
| `src/engine/engine.ts` | HIGH | Physics, collision, scoring, state machine |
| `src/state/saveState.ts` | HIGH | Player data persistence — schema changes need migration |
| `src/main.ts` | HIGH | Wires all engine callbacks — wrong bindings break the whole loop |
| `src/renderer/canvasRenderer.ts` | MEDIUM | Visual only; no game logic side-effects |
| `src/ui/uiController.ts` | MEDIUM | DOM sync; silent failures if IDs misalign with index.html |
| `index.html` | MEDIUM | Structural DOM changes invalidate UIController element cache |
| `src/style.css` | LOW | Visual polish; no logic impact |

---

## Key Invariants (Never Break)
1. `npm run typecheck` must exit 0 before any commit.
2. `npm run test` must pass all suites before any commit.
3. The engine's physics accumulator loop must not read DOM elements on every tick — cache calibration state once per frame outside the accumulator.
4. `localStorage` keys are versioned (`_v6` suffix). Changing a key version clears all existing player saves — treat as a breaking migration.
