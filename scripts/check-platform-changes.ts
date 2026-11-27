import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isPlatform, load, type Pkg } from './workspace-packages';

const USAGE = `Usage: pnpm check:platform-changes [--base <ref>]

A platform package whose api/*.api.txt changed since <ref> (default origin/main) must also change its
CHANGELOG.md and raise its version in package.json.

  --base <ref>   the ref to compare with; CI passes HEAD^1, the base of the merge commit
  --help         print this text

Exit codes: 0 nothing to report, 1 a surface change without its changelog or version bump, 2 bad arguments.
`;

export interface Changes {
  /** Paths changed since the base, from the repository root. */
  changed: readonly string[];
  /** A file at the base, or undefined when it did not exist there. */
  atBase: (path: string) => string | undefined;
  /** A file at the head. */
  atHead: (path: string) => string | undefined;
}

const versionOf = (manifest: string | undefined): string | undefined =>
  manifest === undefined ? undefined : JSON.parse(manifest).version;

function parts(version: string): number[] {
  return version.split('-')[0]?.split('.').map(Number) ?? [];
}

export function isHigher(next: string, previous: string): boolean {
  const [a, b] = [parts(next), parts(previous)];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

export function checkPlatformChanges(packages: readonly Pkg[], changes: Changes): string[] {
  return packages
    .filter(({ dir }) => isPlatform(dir))
    .flatMap(({ name, dir }) => {
      const surfaceChanged = changes.changed.some(
        (path) => path.startsWith(`${dir}/api/`) && path.endsWith('.api.txt')
      );
      const baseVersion = versionOf(changes.atBase(`${dir}/package.json`));
      if (!surfaceChanged || baseVersion === undefined) return [];

      const problems: string[] = [];
      if (!changes.changed.includes(`${dir}/CHANGELOG.md`)) {
        problems.push(`${name}: its API snapshot changed but CHANGELOG.md did not`);
      }
      const headVersion = versionOf(changes.atHead(`${dir}/package.json`));
      if (headVersion === undefined || !isHigher(headVersion, baseVersion)) {
        problems.push(`${name}: its API snapshot changed but version is still ${baseVersion}`);
      }
      return problems;
    });
}

function git(root: string, ...args: string[]): string | undefined {
  const { status, stdout } = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return status === 0 ? stdout : undefined;
}

function gitChanges(root: string, base: string): Changes | undefined {
  const diff = git(root, 'diff', '--name-only', `${base}...HEAD`);
  if (diff === undefined) return undefined;
  return {
    changed: diff.split('\n').filter(Boolean),
    atBase: (path) => git(root, 'show', `${base}:${path}`),
    atHead: (path) => git(root, 'show', `HEAD:${path}`),
  };
}

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(argv: readonly string[], root: string): Outcome {
  if (argv.includes('--help') || argv.includes('-h')) return { code: 0, stdout: USAGE, stderr: '' };

  const baseAt = argv.indexOf('--base');
  const base = baseAt === -1 ? 'origin/main' : argv[baseAt + 1];
  const unknown = argv.find(
    (arg, index) => arg.startsWith('-') && arg !== '--base' && index !== baseAt + 1
  );
  if (base === undefined || unknown !== undefined) {
    return {
      code: 2,
      stdout: '',
      stderr: `check:platform-changes: bad arguments${unknown ? ` ${unknown}` : ''}\n${USAGE}`,
    };
  }

  const changes = gitChanges(root, base);
  if (changes === undefined) {
    return { code: 2, stdout: '', stderr: `check:platform-changes: cannot diff against ${base}\n` };
  }

  const problems = checkPlatformChanges(load(root), changes);
  return problems.length === 0
    ? {
        code: 0,
        stdout: `check:platform-changes: every API change against ${base} has its changelog and version bump\n`,
        stderr: '',
      }
    : { code: 1, stdout: '', stderr: `${problems.join('\n')}\n` };
}

if (process.argv[1]?.endsWith('check-platform-changes.ts')) {
  const outcome = run(process.argv.slice(2), resolve(import.meta.dirname, '..'));
  process.stdout.write(outcome.stdout);
  process.stderr.write(outcome.stderr);
  process.exitCode = outcome.code;
}
