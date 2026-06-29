import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        lines: 70,
        statements: 70,
        branches: 70,
        functions: 75,
      },
    },
  },
});
