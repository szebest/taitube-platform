import { defineConfig, devices } from '@playwright/test';

export type ClientAppSuite = {
  /** The port the app's `dev`, `preview` and `start` serve: under `E2E_API_URL` the compose API allows it. */
  devPort: number;
  /**
   * The first of the ports a run takes (the app +1, the stack +2, the API +3, S3 +4, the app
   * alongside +5) unless `E2E_PORT_BASE` says otherwise; each app's suite and each checkout running
   * at once needs its own.
   */
  defaultPortBase: number;
  /** The other client app, built and served next to this one, for a flow that crosses origins. */
  alongside?: { appDir: string; devPort: number };
};

function servedApp(appDir: string, port: number, apiUrl: string, origin: string) {
  return {
    command: `vite build --outDir e2e/dist && srvx serve --prod --host 127.0.0.1 --port ${port} --static ../client --entry e2e/dist/server/server.js`,
    cwd: appDir,
    env: { VITE_API_BASE_URL: apiUrl },
    url: origin,
    timeout: 120_000,
  };
}

/**
 * A client app's Playwright suite, `e2e/` beside its `playwright.config.ts`: the in-process stack
 * (`tests/e2e/web-stack.ts`) and the app built into `e2e/dist` and served by srvx (the other app too,
 * with `alongside`), or with `E2E_API_URL` the API already running and the apps on their dev ports.
 */
export function clientAppPlaywrightConfig({ devPort, defaultPortBase, alongside }: ClientAppSuite) {
  const portBase = Number(process.env['E2E_PORT_BASE'] ?? defaultPortBase);
  const externalApiUrl = process.env['E2E_API_URL'];
  const ci = process.env['CI'] === 'true';

  const ports = {
    app: portBase + 1,
    stack: portBase + 2,
    api: portBase + 3,
    s3: portBase + 4,
    alongside: portBase + 5,
  };
  const servedAt = (localPort: number, port: number) =>
    externalApiUrl
      ? { port: localPort, origin: `http://localhost:${localPort}` }
      : { port, origin: `http://127.0.0.1:${port}` };
  const app = servedAt(devPort, ports.app);
  const other = alongside && servedAt(alongside.devPort, ports.alongside);
  const apiUrl = externalApiUrl ?? `http://127.0.0.1:${ports.api}`;
  const stackUrl = `http://127.0.0.1:${ports.stack}/`;

  const stackArgs = [
    `--stack-port ${ports.stack}`,
    `--origin ${app.origin}`,
    externalApiUrl
      ? `--api-url ${externalApiUrl}`
      : `--api-port ${ports.api} --s3-port ${ports.s3}`,
  ].join(' ');

  return defineConfig<object, { stackUrl: string; alongsideUrl: string }>({
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
      alongsideUrl: other?.origin ?? '',
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
      { name: 'app', ...servedApp('.', app.port, apiUrl, app.origin) },
      ...(alongside && other
        ? [{ name: 'alongside', ...servedApp(alongside.appDir, other.port, apiUrl, other.origin) }]
        : []),
    ],
  });
}
