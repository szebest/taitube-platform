import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '@vp/logger';
import { run } from './cli';
import type { Attempt } from './runner';

const execAsync = promisify(exec);

/** The one place a thrown process or fetch failure becomes an answer the runner reads. */
async function attempt<T>(call: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { type: 'done', value: await call() };
  } catch (cause) {
    return { type: 'failed', reason: String(cause) };
  }
}

async function fetchMetricsText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
  return res.text();
}

const log = createLogger({ service: 'compose-autoscaler', level: 'info', format: 'pretty' });

try {
  run({
    argv: process.argv.slice(2),
    env: process.env,
    executor: (cmd) => attempt(() => execAsync(cmd)),
    fetcher: (url) => attempt(() => fetchMetricsText(url)),
    onSignal: (signal, handler) => process.on(signal, handler),
    exit: (code) => process.exit(code),
    print: (text) => process.stdout.write(`${text}\n`),
    log,
  });
} catch (err) {
  log.fatal({ err }, 'compose-autoscaler failed');
  process.exit(1);
}
