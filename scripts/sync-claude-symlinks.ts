import { lstatSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { glob } from 'node:fs/promises';

const ROOT = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');

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

const stale: string[] = [];
let created = 0;

for (const agents of agentsFiles.sort()) {
  const dir = dirname(join(ROOT, agents));
  const link = join(dir, 'CLAUDE.md');
  const state = linkState(link);
  if (state === 'ok') continue;

  const shown = relative(ROOT, link);
  if (check) {
    stale.push(`${shown} (${state})`);
    continue;
  }
  if (state === 'wrong') rmSync(link);
  symlinkSync('AGENTS.md', link);
  console.log(`  linked ${shown} -> AGENTS.md`);
  created += 1;
}

if (check && stale.length > 0) {
  console.error(`\nCLAUDE.md symlinks out of sync (${stale.length}):\n`);
  for (const s of stale) console.error(`  ✗ ${s}`);
  console.error('\nRun: pnpm sync:claude\n');
  process.exit(1);
}

console.log(
  check
    ? `CLAUDE.md symlinks OK — ${agentsFiles.length} AGENTS.md files, all linked.`
    : `Done — ${agentsFiles.length} AGENTS.md files, ${created} link(s) created.`
);
