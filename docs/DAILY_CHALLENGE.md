# Daily Challenge rules

Daily is a common local challenge for one UTC calendar date and one explicit
rules version. It is intended for comparable play on the same build; local
storage scores are not tamper-resistant or suitable for competitive ranking.

## Challenge identity

The challenge ID is `YYYY-MM-DD` from `Date.toISOString()`. A run captures that
ID and `rulesVersion: 1` when it starts. A run that crosses UTC midnight keeps
its original identity. Retrying starts a new run and captures the current UTC
date.

The random seed is 32-bit FNV-1a over the UTF-8/ASCII identity string:

```text
gravitypivot|<rulesVersion>|<challengeId>
```

For example, `gravitypivot|1|2026-10-06` hashes to `231891857`. Seeded world
generation is independent of viewport dimensions, local timezone, owned
upgrades, particles, and background stars.

## Version 1 gameplay rules

- Shield, magnet, and tether upgrades are fixed at level 1.
- Physics speed and collision substeps use defaults; substeps are fixed at 4.
- Safety gaps, substepping, and collinear fallback protection are enabled.
- Speed, substep, hazard-buffer, and calibration changes are rejected by the
  engine while a Daily run is active.
- Keyboard, mouse, and touch acquire the nearest tether anchor automatically.
  Pointer aim remains available in Standard runs. Equal-distance choices use
  the stable generated node ID as a tie-breaker.
- Skins, audio, and reduced-motion preferences are cosmetic. Cores collected in
  Daily can still fund later purchases, which do not affect the current run.

Each Daily best is stored by `(challengeId, rulesVersion)`. The legacy v6 Daily
best remains untouched because it may contain Standard scores. Version 1 starts
with its own unqualified record space.

## Limits and version policy

The shared rules remove known local sources of gameplay variation, but browser
floating-point implementations, manual clock changes, modified clients, and
different app builds can still diverge. Aspect ratios also expose different
amounts of route ahead while preserving the full corridor height: the current
desktop layout shows about 999 world units ahead of the ship, while the tested
Pixel 7 layout shows about 354. Daily therefore shares a seed and physics rules;
it does not guarantee identical visual information on every screen size. This
is not a server-verified leaderboard.

Any later change to generation, physics, scoring, or input that affects Daily
must receive a rules-version decision and golden seed/replay coverage.
