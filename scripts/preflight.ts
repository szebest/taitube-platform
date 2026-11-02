import { execFileSync } from 'node:child_process';
import { availableBytes, type Disk, shortfalls, THRESHOLDS } from './preflight/disks';

type Run = (command: string, args: readonly string[]) => string;

const run: Run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Docker on this machine runs in colima, whose disk fills up apart from the host's. */
function colimaRunning(): boolean {
  try {
    run('colima', ['status']);
    return true;
  } catch {
    return false;
  }
}

/** The checkout's disk, and colima's Docker disk when colima runs, each read with `df -k`. */
export function measuredDisks(df: Run, colima: boolean): Disk[] {
  const host: Disk = {
    label: 'the disk holding this checkout',
    freeBytes: availableBytes(df('df', ['-k', '.'])),
    minimumGib: THRESHOLDS.hostFreeGib,
    fix: 'Free space, or remove old worktrees and their node_modules.',
  };
  if (!colima) return [host];
  return [
    host,
    {
      label: 'the colima Docker disk',
      freeBytes: availableBytes(df('colima', ['ssh', '--', 'df', '-k', '/var/lib/docker'])),
      minimumGib: THRESHOLDS.dockerFreeGib,
      fix: 'Free it with docker system prune -a, or grow it with colima stop && colima start --disk <GiB>.',
    },
  ];
}

function main(): void {
  const short = shortfalls(measuredDisks(run, colimaRunning()));
  for (const line of short) process.stderr.write(`preflight: ${line}\n`);
  if (short.length > 0) process.exitCode = 1;
}

if (import.meta.main) main();
