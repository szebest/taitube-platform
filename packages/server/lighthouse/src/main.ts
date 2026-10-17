import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { stopProcessGroup } from './process-group';
import { representativeReports, summaryLine } from './summary';

const HELP = `pnpm lighthouse

Builds apps/client/web, serves it over the in-process stack (tests/e2e/web-stack.ts) on 127.0.0.1,
runs Lighthouse CI against it in Playwright's Chromium, and prints the performance score, LCP and CLS.
The thresholds in lighthouserc.json warn and never fail. Nothing leaves the machine: the report is
written to packages/server/lighthouse/dist/report. LIGHTHOUSE_PORT_BASE moves the four ports from 5430.`;

const READY_TIMEOUT_MS = 180_000;
const READY_POLL_MS = 500;

if (process.argv.includes('--help')) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

const base = Number(process.env.LIGHTHOUSE_PORT_BASE ?? 5430);
const ports = { app: base + 1, stack: base + 2, api: base + 3, s3: base + 4 };
const appUrl = `http://127.0.0.1:${ports.app}`;
const stackUrl = `http://127.0.0.1:${ports.stack}/`;

const packageDir = resolve(import.meta.dirname, '..');
const repoDir = resolve(packageDir, '../../..');
const webDir = resolve(repoDir, 'apps/client/web');
const buildDir = resolve(packageDir, 'dist/web');
const reportDir = resolve(packageDir, 'dist/report');

const children: ChildProcess[] = [];

/** In a process group of its own, so the stop reaches the server pnpm started, not just pnpm. */
function start(command: string, args: string[], cwd: string): void {
  children.push(spawn(command, args, { cwd, stdio: 'inherit', detached: true }));
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): void {
  execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!(await answers(url))) {
    if (Date.now() > deadline) throw new Error(`${url} did not answer in time`);
    await new Promise((resolveWait) => setTimeout(resolveWait, READY_POLL_MS));
  }
}

try {
  rmSync(reportDir, { recursive: true, force: true });
  start(
    'pnpm',
    [
      '--workspace-root',
      'e2e:web-stack',
      ...['--stack-port', String(ports.stack), '--origin', appUrl],
      ...['--api-port', String(ports.api), '--s3-port', String(ports.s3)],
    ],
    repoDir
  );
  run('pnpm', ['exec', 'vite', 'build', '--outDir', buildDir], webDir, {
    VITE_API_BASE_URL: `http://127.0.0.1:${ports.api}`,
  });
  start(
    'pnpm',
    ['exec', 'srvx', 'serve', '--prod', '--host', '127.0.0.1', '--port', String(ports.app)].concat([
      '--static',
      '../client',
      '--entry',
      resolve(buildDir, 'server/server.js'),
    ]),
    webDir
  );
  await waitFor(stackUrl);
  await waitFor(appUrl);

  run('pnpm', ['run', 'collect', `--collect.url=${appUrl}/`], packageDir, {
    CHROME_PATH: chromium.executablePath(),
  });

  const manifest = JSON.parse(readFileSync(resolve(reportDir, 'manifest.json'), 'utf8'));
  for (const { url, jsonPath } of representativeReports(manifest)) {
    process.stdout.write(`${summaryLine(url, JSON.parse(readFileSync(jsonPath, 'utf8')))}\n`);
  }
} finally {
  for (const { pid } of children) {
    if (pid !== undefined) stopProcessGroup(pid);
  }
}
