import { defineConfig } from 'vitest/config'

// Ren logik utan DOM: piller, tumregel, format, Systembolaget-parsern. Workerns routes testas i worker/vitest.config.ts.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'test/**/*.test.ts'] },
})
