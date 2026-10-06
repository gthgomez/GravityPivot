import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/GravityPivot/' : '/',
  server: {
    port: 3000,
    open: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/engine/engine.ts',
        'src/world/generator.ts',
        'src/state/saveState.ts',
        'src/state/saveSchema.ts',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
