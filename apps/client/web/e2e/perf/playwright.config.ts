import { resolve } from 'node:path';
import { clientAppPlaywrightConfig } from '../../../../../tests/playwright/config';

const APP_DIR = resolve(import.meta.dirname, '../..');

const config = clientAppPlaywrightConfig({ devPort: 5173, defaultPortBase: 5390 });

/** The click path needs the stack and the served app, not the dev server or the studio. */
export default {
  ...config,
  testDir: '.',
  testMatch: '*.test.ts',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  webServer: [config.webServer ?? []]
    .flat()
    .filter(({ name }) => name === 'stack' || name === 'app')
    .map((server) => ({ ...server, cwd: APP_DIR })),
};
