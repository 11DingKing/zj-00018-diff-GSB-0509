import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/services/**/*.ts'],
      exclude: ['src/lib/prisma.ts', 'src/lib/redis.ts'],
      thresholds: {
        lines: 85,
      },
    },
  },
});
