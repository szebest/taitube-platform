import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MARKER = '# installed by scripts/install-git-hooks.ts';

/**
 * The pre-commit every worktree of the clone shares, in the common hooks directory: it runs the
 * checked-out branch's `.vite-hooks/pre-commit` from the worktree top level, and the hook that was
 * there before on a branch that has none. `core.hooksPath` stays unset, so no worktree loses its hooks.
 */
const SHIM = `#!/bin/sh
${MARKER}
top="$(git rev-parse --show-toplevel)"
if [ -x "$top/.vite-hooks/pre-commit" ]; then
  cd "$top" && exec "$top/.vite-hooks/pre-commit" "$@"
fi
previous="$(dirname "$0")/pre-commit.previous"
if [ -x "$previous" ]; then
  exec "$previous" "$@"
fi
`;

function git(cwd: string, ...args: string[]): string | undefined {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return run.status === 0 ? run.stdout.trim() : undefined;
}

const cwd = resolve(process.argv[2] ?? process.cwd());
const common = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');

if (common === undefined) {
  process.stdout.write('install-git-hooks: not a git checkout, nothing to install\n');
} else {
  if (git(cwd, 'config', '--get', 'core.hooksPath') === '.vite-hooks/_') {
    git(cwd, 'config', '--unset', 'core.hooksPath');
  }
  const hook = join(common, 'hooks', 'pre-commit');
  const installed = existsSync(hook) ? readFileSync(hook, 'utf8') : '';
  if (installed !== '' && !installed.includes(MARKER)) {
    renameSync(hook, `${hook}.previous`);
  }
  writeFileSync(hook, SHIM);
  chmodSync(hook, 0o755);
  process.stdout.write(`install-git-hooks: ${hook}\n`);
}
