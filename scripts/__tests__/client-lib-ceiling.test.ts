import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const FIXTURES = 'scripts/__tests__/typecheck-fixtures';

function failingFiles(): string[] {
  const tsc = spawnSync(join(ROOT, 'node_modules/.bin/tsc'), ['-p', FIXTURES], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return [...tsc.stdout.matchAll(/typecheck-fixtures\/([\w-]+\.ts)\(\d+,\d+\): error/g)].map(
    ([, file]) => file ?? ''
  );
}

describe('client lib ceiling', () => {
  it('fails typecheck on an ES2025 built-in and not on an ES2024 one', () => {
    expect(failingFiles()).toEqual(['set-union.ts']);
  });
});
