import { defineConfig, devices } from '@playwright/test';

const STACK_PORT = 5392;
const API_PORT = 3391;
const S3_PORT = 9391;

const externalApiUrl = process.env['E2E_API_URL'];
const reduced = process.env['E2E_REDUCED'] === 'true';
const ci = process.env['CI'] === 'true';

const web = externalApiUrl
  ? { port: 5173, origin: 'http://localhost:5173' }
  : { port: 5391, origin: 'http://127.0.0.1:5391' };
const apiUrl = externalApiUrl ?? `http://127.0.0.1:${API_PORT}`;
const stackUrl = `http://127.0.0.1:${STACK_PORT}/`;

const stackArgs = [
  `--stack-port ${STACK_PORT}`,
  `--web-origin ${web.origin}`,
  externalApiUrl ? `--api-url ${externalApiUrl}` : `--api-port ${API_PORT} --s3-port ${S3_PORT}`,
].join(' ');

export default defineConfig<object, { stackUrl: string }>({
  testDir: 'e2e',
  outputDir: 'e2e/test-results',
  forbidOnly: true,
  fullyParallel: true,
  workers: ci ? 2 : undefined,
  grepInvert: reduced ? /@extended/ : undefined,
  reporter: ci
    ? [['list'], ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }]]
    : 'list',
  use: {
    baseURL: web.origin,
    stackUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'stack',
      command: `pnpm exec tsx ../../tests/e2e/web-stack.ts ${stackArgs}`,
      url: stackUrl,
      timeout: 180_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'web',
      command: `vite build --outDir e2e/dist && srvx serve --prod --port ${web.port} --static ../client --entry e2e/dist/server/server.js`,
      env: { VITE_API_BASE_URL: apiUrl },
      url: web.origin,
      timeout: 120_000,
    },
  ],
});
