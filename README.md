# Gravity Pivot - Refactored Web Edition

A hyper-casual physics-based space navigation game. Pilot your spark spacecraft through an infinite cave, tethering to gravitational anchor nodes to orbit, swing, and sling yourself around hazards while collecting energy cores.

## Tech Stack
- **Language:** TypeScript (strict mode)
- **Styling:** Vanilla CSS (custom properties, theme variables, zero utility overhead)
- **Build Tool:** Vite
- **Testing Framework:** Vitest

## Game Architecture
The code is split into decoupled modules using constructor Dependency Injection:
- `src/main.ts` - Bootstrap loader and DI configuration
- `src/ui/uiController.ts` - Interface layer (owns all DOM element interactions)
- `src/renderer/canvasRenderer.ts` - Graphic renderer (canvas-only drawing)
- `src/engine/engine.ts` - Pure physics/simulation loop (no DOM or Canvas coupling)
- `src/world/generator.ts` - Infinite sliding window procedural generation & cave boundaries
- `src/audio/synth.ts` - Web Audio API sound synthesis and SFX stems
- `src/effects/particles.ts` - Zero-allocation swap-and-pop particle pool
- `src/state/saveState.ts` - Upgrade level and core balance persistent serialization
- `src/constants.ts` - Shared enums (`FlightState`, `GamePhase`) and settings configurations

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Install dependencies
npm install
```

### Development
```bash
# Launch hot-reloading development server
npm run dev
```

### Testing
```bash
# Run unit tests
npm run test

# Type-check TypeScript files
npm run typecheck
```

### Build
```bash
# Bundle production build to /dist
npm run build
```
