import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, matchesGlob, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');

const SOURCE_ROOTS = ['apps', 'packages', 'scripts'];

let tracked: readonly string[] | undefined;

/** The index, listed once per process: every ratchet filters the same list instead of forking git. */
function allTracked(): readonly string[] {
  tracked ??= execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  return tracked;
}

const globMatches = new Map<string, ReadonlySet<string>>();

/** The tracked files a glob matches, worked out once per glob: `matchesGlob` compiles it on every call. */
function matchingGlob(glob: string): ReadonlySet<string> {
  let matched = globMatches.get(glob);
  if (matched === undefined) {
    matched = new Set(allTracked().filter((file) => matchesGlob(file, glob)));
    globMatches.set(glob, matched);
  }
  return matched;
}

interface Pathspec {
  exclude: boolean;
  matches: (file: string) => boolean;
}

/** The pathspec forms the suite uses: a path, `:(glob)` and `:(exclude)` / `:(exclude,glob)`. */
function pathspec(spec: string): Pathspec {
  let flags: string[] = [];
  let path = spec;
  if (spec.startsWith(':(')) {
    const magicEnd = spec.indexOf(')');
    flags = spec.slice(2, magicEnd).split(',');
    path = spec.slice(magicEnd + 1);
  }

  const exclude = flags.includes('exclude');
  if (flags.includes('glob')) {
    const matched = matchingGlob(path);
    return { exclude, matches: (file) => matched.has(file) };
  }
  const directory = path.endsWith('/') ? path : `${path}/`;
  return { exclude, matches: (file) => file === path || file.startsWith(directory) };
}

/** What `git ls-files -- <pathspecs>` lists, without a process per call. */
export function trackedFiles(...pathspecs: string[]): string[] {
  const specs = pathspecs.map(pathspec);
  const includes = specs.filter((spec) => !spec.exclude);
  const excludes = specs.filter((spec) => spec.exclude);
  return allTracked().filter(
    (file) =>
      (includes.length === 0 || includes.some((spec) => spec.matches(file))) &&
      !excludes.some((spec) => spec.matches(file))
  );
}

export function isSpec(file: string): boolean {
  return /\.test\.tsx?$/.test(file);
}

export function productionSources(): string[] {
  return trackedFiles(...SOURCE_ROOTS)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .filter((file) => !isSpec(file))
    .filter((file) => !/\/__(tests|mocks)__\//.test(file));
}

const contents = new Map<string, string>();

export function read(file: string): string {
  let text = contents.get(file);
  if (text === undefined) {
    text = readFileSync(join(ROOT, file), 'utf8');
    contents.set(file, text);
  }
  return text;
}
