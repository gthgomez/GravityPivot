import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
