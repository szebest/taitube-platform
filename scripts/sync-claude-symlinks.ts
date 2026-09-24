import { lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { glob } from 'node:fs/promises';
import { createLogger } from '../packages/server/logger/src/index';

const ROOT = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const log = createLogger({ service: 'sync-claude-symlinks', level: 'info', format: 'pretty' });

function linkState(path: string): 'ok' | 'missing' | 'wrong' {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return 'missing';
  if (!stat.isSymbolicLink()) return 'wrong';
  return readlinkSync(path) === 'AGENTS.md' ? 'ok' : 'wrong';
}

const agentsFiles: string[] = [];
for await (const entry of glob('**/AGENTS.md', {
  cwd: ROOT,
  exclude: (name) =>
    name === 'node_modules' || name === 'dist' || name === '.agents' || name === '.git',
})) {
  agentsFiles.push(entry);
}

const stale: { link: string; state: 'missing' | 'wrong' }[] = [];
let created = 0;

for (const agents of agentsFiles.sort()) {
  const dir = dirname(join(ROOT, agents));
  const link = join(dir, 'CLAUDE.md');
  const state = linkState(link);
  if (state === 'ok') continue;

  const shown = relative(ROOT, link);
  if (check) {
    stale.push({ link: shown, state });
    continue;
  }
  if (state === 'wrong') rmSync(link);
  symlinkSync('AGENTS.md', link);
  log.info({ link: shown, target: 'AGENTS.md' }, 'linked claude.md');
  created += 1;
}

if (check && stale.length > 0) {
  for (const { link, state } of stale) {
    log.error({ link, state }, 'claude.md symlink out of sync');
  }
  log.error({ stale: stale.length, fix: 'pnpm sync:claude' }, 'claude.md symlinks out of sync');
  process.exit(1);
}

if (check) {
  log.info(
    { agentsFiles: agentsFiles.length },
    'claude.md symlinks ok, all agents.md files linked'
  );
} else {
  log.info({ agentsFiles: agentsFiles.length, created }, 'claude.md symlinks synced');
}
