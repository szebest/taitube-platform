import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fromPromise } from '@vp/result';
import { run } from './cli';
import type { DemoHost, ExecResult } from './host';
import { seedDemo } from './seed';

const host: DemoHost = {
  cwd: process.cwd(),
  env: process.env,
  platform: process.platform,
  nodeVersion: process.version,
  tty: process.stdout.isTTY === true,
  now: () => Date.now(),
  print: (line) => process.stdout.write(`${line}\n`),
  show: (command, args) =>
    new Promise<number>((resolve) => {
      spawn(command, [...args], { stdio: ['ignore', 'inherit', 'inherit'] })
        .on('error', () => resolve(127))
        .on('close', (code) => resolve(code ?? 1));
    }),
  capture: (command, args) =>
    new Promise<ExecResult>((resolve) => {
      execFile(command, [...args], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        const code =
          error === null
            ? 0
            : error.code === 'ENOENT'
              ? 127
              : typeof error.code === 'number'
                ? error.code
                : 1;
        resolve({ code, stdout, stderr: stderr || (error?.message ?? '') });
      });
    }),
  fileExists: (path) => existsSync(path),
  readFile: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
  writeFile: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  },
  removePath: (path) => rmSync(path, { recursive: true, force: true }),
  httpOk: async (url) => {
    const answered = await fromPromise(
      fetch(url, { signal: AbortSignal.timeout(3000) }),
      () => undefined
    );
    return answered.ok && answered.value?.ok === true;
  },
};

process.exitCode = await run(process.argv.slice(2), host, seedDemo);
