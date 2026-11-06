import { glob, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SOURCES = [
  'apps/client/*/src/**/*.ts',
  'apps/client/*/src/**/*.tsx',
  'packages/client/*/src/**/*.ts',
  'packages/client/*/src/**/*.tsx',
];

const PREFIX = /(?<![\w-])tw:/g;

const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));

let rewritten = 0;

for (const pattern of SOURCES) {
  for await (const file of glob(pattern, { cwd: root })) {
    const path = join(root, file);
    const source = await readFile(path, 'utf8');
    const stripped = source.replace(PREFIX, '');
    if (stripped === source) {
      continue;
    }
    await writeFile(path, stripped);
    rewritten += 1;
  }
}

process.stdout.write(`strip-tw-prefix: ${rewritten} files rewritten\n`);
