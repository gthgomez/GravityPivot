import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/GravityPivot/' : '/',
  server: {
    port: 3000,
    open: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
