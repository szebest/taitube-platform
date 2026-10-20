import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Every story as a test in headless Chromium, its a11y checks failing the run (`a11y.test: 'error'`).
 * It sits in `.storybook/` so the root run's `vitest*.config.ts` projects never pick it up.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [storybookTest({ configDir: fileURLToPath(new URL('.', import.meta.url)) })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
