import { defineConfig } from '@playwright/test';

// LB_TIME_SCALE stretches deadlines on a machine that stalls (for example a sleeping laptop).
const scale = Number(process.env.LB_TIME_SCALE ?? 1);

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  testIgnore: process.env.LB_SHOTS ? [] : ['screenshots.spec.ts'],
  timeout: 60_000 * scale,
  expect: { timeout: 10_000 * scale },
  workers: scale > 1 ? 1 : 2,
  reporter: [['list']],
  outputDir: 'test-results',
});
