import { defineConfig, devices } from '@playwright/test';

const PORT = 6008;

/** Set to a running Storybook to skip the preview server (a run in the pinned image from a Mac). */
const external = process.env.VISUAL_BASE_URL;

/**
 * The visual suite over the built workbench (`pnpm build:storybook` first). It runs in the pinned
 * Playwright image, whose fonts and Chromium the baselines were drawn with; `--update-snapshots`
 * redraws them, in the same image.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'visual.test.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 } },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: external ?? `http://127.0.0.1:${PORT}`,
    viewport: { width: 800, height: 600 },
  },
  webServer: external
    ? undefined
    : {
        command: `node node_modules/vite/bin/vite.js preview --outDir storybook-static --port ${PORT} --strictPort --host 127.0.0.1`,
        cwd: '..',
        url: `http://127.0.0.1:${PORT}/index.json`,
        reuseExistingServer: false,
      },
});
