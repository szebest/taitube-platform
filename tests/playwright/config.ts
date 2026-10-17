import { defineConfig, devices } from '@playwright/test';

export type ClientAppSuite = {
  /** The port the app's `dev`, `preview` and `start` serve: under `E2E_API_URL` the compose API allows it. */
  devPort: number;
  /**
   * The first of the four ports a run takes (the app +1, the stack +2, the API +3, S3 +4) unless
   * `E2E_PORT_BASE` says otherwise; each app's suite and each checkout running at once needs its own.
   */
  defaultPortBase: number;
};

/**
 * A client app's Playwright suite, `e2e/` beside its `playwright.config.ts`: the in-process stack
 * (`tests/e2e/web-stack.ts`) and the app built into `e2e/dist` and served by srvx, or with
 * `E2E_API_URL` the API already running and the app on its dev port.
 */
export function clientAppPlaywrightConfig({ devPort, defaultPortBase }: ClientAppSuite) {
  const portBase = Number(process.env['E2E_PORT_BASE'] ?? defaultPortBase);
  const externalApiUrl = process.env['E2E_API_URL'];
  const ci = process.env['CI'] === 'true';

  const ports = { app: portBase + 1, stack: portBase + 2, api: portBase + 3, s3: portBase + 4 };
  const app = externalApiUrl
    ? { port: devPort, origin: `http://localhost:${devPort}` }
    : { port: ports.app, origin: `http://127.0.0.1:${ports.app}` };
  const apiUrl = externalApiUrl ?? `http://127.0.0.1:${ports.api}`;
  const stackUrl = `http://127.0.0.1:${ports.stack}/`;

  const stackArgs = [
    `--stack-port ${ports.stack}`,
    `--origin ${app.origin}`,
    externalApiUrl ? `--api-url ${externalApiUrl}` : `--api-port ${ports.api} --s3-port ${ports.s3}`,
  ].join(' ');

  return defineConfig<object, { stackUrl: string }>({
    testDir: 'e2e',
    outputDir: 'e2e/test-results',
    forbidOnly: true,
    fullyParallel: true,
    workers: ci ? 2 : undefined,
    reporter: ci
      ? [['list'], ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }]]
      : 'list',
    use: {
      baseURL: app.origin,
      stackUrl,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
      {
        name: 'stack',
        command: `pnpm --workspace-root e2e:web-stack ${stackArgs}`,
        url: stackUrl,
        timeout: 180_000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
      },
      {
        name: 'app',
        command: `vite build --outDir e2e/dist && srvx serve --prod --host 127.0.0.1 --port ${app.port} --static ../client --entry e2e/dist/server/server.js`,
        env: { VITE_API_BASE_URL: apiUrl, VITE_OTEL_TRACES_URL: 'http://localhost:4318/v1/traces' },
        url: app.origin,
        timeout: 120_000,
      },
    ],
  });
}
