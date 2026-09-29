# Security Policy — Gravity Pivot

## Project status: proprietary, not open source

Gravity Pivot is proprietary software. The source is published for source visibility and transparency only. The repository [LICENSE](LICENSE) is a proprietary license notice that grants no permission to copy, modify, redistribute, or build derivative works. The [README](README.md) states this in its opening banner.

Because no permission to use the code has been granted, a defect in it is not a "vulnerability" in the open-source sense. It is a question about unauthorized use of unlicensed software, and that question belongs to the owner of the code, not to a public disclosure process. This file exists so the boundary is stated plainly instead of left to inference.

## What this repository does not offer

- **No security support.** The maintainer does not triage, investigate, or remediate security reports for Gravity Pivot.
- **No coordinated disclosure program.** There is no embargo, no safe harbor, and no private disclosure window.
- **No bug bounty.** No reward is offered.
- **No response-time commitment.** There is no SLA and no support window.
- **No supported versions.** No release is a supported security-fix channel.

## Project shape and what that implies

Gravity Pivot is a browser game in strict-mode TypeScript, built with Vite and tested with Vitest. The code is split into decoupled modules with constructor dependency injection: a pure physics engine with no DOM or Canvas coupling, a canvas renderer, a UI controller that owns all DOM interaction, procedural world generation, Web Audio synthesis, and a save-state serializer.

This repository contains no server component, no database, no account system, and no deployment credentials. There is no hosted service to attack and no user data store to breach; a player's save file is that player's own data on their own machine.

That is a description of the architecture, not a security guarantee. Client-side code can still contain parsing defects, unsafe handling of persisted state, or dependency problems, and "it runs in a browser" is not a defence.

## Documented material

[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) is the project's design record. It is cited for completeness; it is not a security attestation.

## Reporting a genuine concern

If you believe you have found a genuine security concern, the honest position is that the maintainer has not accepted a support obligation, so there is no guaranteed response. If you choose to raise it anyway:

- Prefer GitHub's private vulnerability reporting for this repository (the **Security** tab → **Report a vulnerability**), if it is available to you.
- Otherwise contact the repository owner through their public profile at <https://github.com/gthgomez>.
- Do not open a public issue, and do not include working exploit code or third-party personal data in a public report.
- You receive no service commitment, no bounty, and no assurance of a fix.

## Visibility is not permission

The repository being public creates no support obligation. Publishing source does not grant a license, does not create a support contract, and does not make the maintainer a vendor to you. Opening an issue or submitting a pull request grants you no rights and creates no partnership; contributions are not accepted for reuse, and no license is granted over anything you send here.

## Third-party dependencies

Third-party components, including the build toolchain and any bundled runtime dependencies, remain under their own licenses and their own security policies. Issues in a dependency should be reported to that project, not here. This document does not extend to them.
