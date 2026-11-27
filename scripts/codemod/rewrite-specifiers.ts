import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { load } from '../workspace-packages';
import { planDirMoves, planScopeRenames } from './dir-moves';
import { loadMoves, type Moves } from './moves';
import { rewriteReferences, sortManifestDependencies } from './references-rewrite';
import { isRewritableSource, rewriteSource } from './source-rewrite';

const ROOT = resolve(import.meta.dirname, '../..');
const TEXT_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|mdx|toml|sh|txt|css|html|mdc)$/;
const TEXT_NAMES = /^(?:Makefile|Dockerfile[\w.-]*|\.[\w.-]+)$/;
const SKIPPED = [
  'pnpm-lock.yaml',
  'scripts/package-moves.json',
  'scripts/codemod/',
  'scripts/__tests__/codemod/',
  'docs/tickets/',
];

export const isRewritableFile = (path: string): boolean =>
  !SKIPPED.some((skipped) => path === skipped || path.startsWith(skipped)) &&
  !path.endsWith('CHANGELOG.md') &&
  (TEXT_EXTENSIONS.test(path) || TEXT_NAMES.test(basename(path)));

export interface CodemodOptions {
  readonly root: string;
  readonly moves: Moves;
  readonly dirMoves: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  readonly write: boolean;
}

export interface CodemodResult {
  readonly changed: readonly string[];
  readonly problems: readonly string[];
}

export function runCodemod(options: CodemodOptions): CodemodResult {
  const { root, moves, dirMoves, files, write } = options;
  const rules = {
    scopeRenames: planScopeRenames(moves, new Set(Object.keys(moves))),
    dirMoves,
  };
  const changed: string[] = [];
  const problems: string[] = [];

  for (const file of files.filter(isRewritableFile)) {
    const absolute = join(root, file);
    if (lstatSync(absolute).isSymbolicLink()) continue;
    const before = readFileSync(absolute, 'utf8');

    let text = before;
    if (isRewritableSource(file)) {
      const source = rewriteSource(file, text, moves);
      text = source.text;
      problems.push(...source.problems);
    }
    text = rewriteReferences(text, file, rules);
    if (basename(file) === 'package.json') text = sortManifestDependencies(before, text);

    if (text === before) continue;
    changed.push(file);
    if (write) writeFileSync(absolute, text);
  }
  return { changed, problems };
}

const flag = (args: readonly string[], name: string): string | undefined => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const csv = (value: string | undefined): string[] => (value ? value.split(',') : []);

/**
 * The moves `--packages` selects, or every move when the flag is absent. A flag written another
 * way (`--packages=a`), left empty or naming a package the moves do not list is an error, never a
 * silent run over the whole repository.
 */
export type Selection = { ok: true; moves: Moves } | { ok: false; problem: string };

export function selectMoves(all: Moves, args: readonly string[]): Selection {
  if (args.some((arg) => arg.startsWith('--packages='))) {
    return { ok: false, problem: 'write --packages <a,b>, not --packages=<a,b>' };
  }
  if (!args.includes('--packages')) return { ok: true, moves: all };
  const only = csv(flag(args, '--packages'));
  if (only.length === 0) return { ok: false, problem: '--packages names no package' };
  const unknown = only.filter((name) => !Object.hasOwn(all, name));
  if (unknown.length > 0) {
    return { ok: false, problem: `--packages names no move for ${unknown.join(', ')}` };
  }
  const moves = Object.fromEntries(Object.entries(all).filter(([name]) => only.includes(name)));
  return { ok: true, moves };
}

function main(args: readonly string[]): number {
  const movesFile = flag(args, '--moves') ?? join(ROOT, 'scripts/package-moves.json');
  const selected = selectMoves(loadMoves(movesFile), args);
  if (!selected.ok) {
    process.stderr.write(`${selected.problem}\n`);
    return 1;
  }
  const { moves } = selected;

  if (args.includes('--plan-dirs')) {
    const excluded = new Set(csv(flag(args, '--exclude')));
    process.stdout.write(`${JSON.stringify(planDirMoves(load(), moves, excluded), null, 2)}\n`);
    return 0;
  }

  const dirMovesFile = flag(args, '--dir-moves');
  const dirMoves = dirMovesFile ? JSON.parse(readFileSync(dirMovesFile, 'utf8')) : {};
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 28 })
    .toString()
    .split('\0')
    .filter(Boolean);

  const { changed, problems } = runCodemod({
    root: ROOT,
    moves,
    dirMoves,
    files,
    write: !args.includes('--dry-run'),
  });
  process.stdout.write(
    `${changed.length} files ${args.includes('--dry-run') ? 'would change' : 'rewritten'}\n`
  );
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1]?.endsWith('rewrite-specifiers.ts')) process.exit(main(process.argv.slice(2)));
