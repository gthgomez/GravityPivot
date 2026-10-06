# Performance profile

**Collected:** 2026-10-06  
**Build:** Vite 8.3.3, TypeScript 7.0.2, Node 24.21.0  
**Purpose:** establish a reproducible local baseline and identify optimizations supported by measurements.

## Limits

The browser measurements ran in Playwright's headless Chromium inside a Linux development container. “Desktop” uses the Playwright Desktop Chrome viewport; “mobile” uses its Pixel 7 emulation. Neither is a physical reference device. The results are diagnostic and cannot qualify desktop or mobile hardware.

## Interactive browser run

Each browser ran an 8-second Standard flight with the production build and no intentional tether input. Frame intervals were measured between `requestAnimationFrame` callbacks. These are scheduling intervals, not isolated GPU render times.

| Environment | Frames / 8 s | p50 interval | p95 | p99 | Max | Script CPU / 8 s |
|---|---:|---:|---:|---:|---:|---:|
| Desktop Chromium headless | 435 | 16.7 ms | 33.3 ms | 49.9 ms | 66.7 ms | 0.572 s |
| Pixel 7 Chromium emulation | 480 | 16.7 ms | 16.7 ms | 16.8 ms | 33.4 ms | 0.571 s |

The desktop container run misses the provisional 16.7 ms p95 target. The mobile emulation result meets it, but does not prove physical-device performance. Repeat both measurements on documented physical devices before making a performance claim or tuning Canvas rendering.

## DOM and persistence

Before the UI optimization, a six-second flight produced 367 mutations each on telemetry sigma, velocity, reach, sector label, and sector progress: about 1,835 mutations across those five elements. The progress bar changes each tick by design; the other readouts were repeatedly assigned unchanged values.

After adding equality guards, the same six-second workload produced:

| Element | Desktop Chromium | Pixel 7 emulation |
|---|---:|---:|
| Telemetry sigma | 0 | 0 |
| Telemetry velocity | 1 | 1 |
| Telemetry reach | 0 | 0 |
| Sector label | 0 | 0 |
| Sector progress bar | 367 | 366 |

The five measured targets fell from about 1,835 to about 367 mutations per six seconds, an 80% reduction. The remaining writes are the changing progress bar and a velocity change.

Natural core collection wrote the 200-byte versioned save blob synchronously. A six-second sample recorded six writes per environment, with a maximum of 0.6 ms on desktop Chromium and 0.3 ms in Pixel 7 emulation. A longer sample saw maximum writes of 2.2 ms and 3.7 ms respectively. These small, variable samples do not justify batching saves, which could risk losing collected cores on abrupt tab closure.

## Seeded simulation stress run

Three independent runs used the same versioned Daily seed and executed 10,000 fixed ticks each. To exercise world extension and culling for about 66,000 world units without ending on a random collision, the harness reset the spark to the corridor center and restored collision invulnerability before each tick. This is an engine stress workload, not representative piloting.

Across the three runs, fixed-tick timings were:

| Statistic | Observed range |
|---|---:|
| p50 | 5.1–5.8 μs |
| p95 | 13.4–20.6 μs |
| p99 | 35.7–64.4 μs |
| Maximum | 5.7–9.7 ms |

The rare maximum outliers are consistent with runtime pauses in this short Node profile and were not isolated further. During each run, retained world data stayed bounded: 18–22 anchors, 53–74 cores, and 315–373 samples per wall. The pooled particle engine peaked at 18 active particles out of 150. These samples show no growing retained world or particle pool during the exercised extensions; private near-miss episode state was not separately instrumented.

## Logic coverage

`npm run verify` now enforces V8 coverage floors for engine, generator, save state, and save schema logic. The current baseline is 93.32% statements, 85.95% branches, 95.29% functions, and 95.16% lines. Floors are 80% statements, functions, and lines, and 70% branches. The uncovered paths are mainly defensive fallbacks and exceptional storage cases; the thresholds leave room for those paths while preventing a substantial regression.

## Next measurement

Run repeated 60 Hz flights on a named physical desktop and a named physical mobile device. Record browser/OS/device, viewport and DPR, input sequence, frame interval percentiles, fixed-tick cost, active map counts, particle count, HUD mutations, and save-write latency. Investigate the desktop p95 miss only if it reproduces on a physical reference device.
