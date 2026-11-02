import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
