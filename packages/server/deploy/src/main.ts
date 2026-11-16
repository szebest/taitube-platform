import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_DOCS, EXTRA_ENV_DOCS, heldLocalCredentials } from '@vp/env-schema';
import { tryCatch } from '@vp/result';
import { run } from './cli';
import type { KeyDocs } from './required-keys';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const docs: KeyDocs = { ...EXTRA_ENV_DOCS, ...ENV_DOCS };

process.exitCode = run(process.argv.slice(2), {
  root,
  docs,
  isLocalCredential: heldLocalCredentials,
  now: () => new Date(),
  readText: (path) =>
    existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined,
  writeText: (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  },
  git: (args) => {
    const output = tryCatch(
      () =>
        execFileSync('git', [...args], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      () => undefined
    );
    return output.ok ? output.value : undefined;
  },
  stdin: () => readFileSync(0, 'utf8'),
  print: (text) => process.stdout.write(`${text}\n`),
});
