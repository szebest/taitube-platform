import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORT_BASE = 5390;

const portBase = Number(process.env['E2E_PORT_BASE'] ?? DEFAULT_PORT_BASE);
const externalApiUrl = process.env['E2E_API_URL'];
const ci = process.env['CI'] === 'true';

const ports = { web: portBase + 1, stack: portBase + 2, api: portBase + 3, s3: portBase + 4 };
const web = externalApiUrl
  ? { port: 5173, origin: 'http://localhost:5173' }
  : { port: ports.web, origin: `http://127.0.0.1:${ports.web}` };
const apiUrl = externalApiUrl ?? `http://127.0.0.1:${ports.api}`;
const stackUrl = `http://127.0.0.1:${ports.stack}/`;

const stackArgs = [
  `--stack-port ${ports.stack}`,
  `--web-origin ${web.origin}`,
  externalApiUrl ? `--api-url ${externalApiUrl}` : `--api-port ${ports.api} --s3-port ${ports.s3}`,
].join(' ');

export default defineConfig<object, { stackUrl: string }>({
  testDir: 'e2e',
  outputDir: 'e2e/test-results',
  forbidOnly: true,
  fullyParallel: true,
  workers: ci ? 2 : undefined,
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
      command: `vite build --outDir e2e/dist && srvx serve --prod --host 127.0.0.1 --port ${web.port} --static ../client --entry e2e/dist/server/server.js`,
      env: { VITE_API_BASE_URL: apiUrl },
      url: web.origin,
      timeout: 120_000,
    },
  ],
});
