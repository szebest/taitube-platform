import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, matchesGlob, posix, resolve } from 'node:path';

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

const WILDCARDS = ['*', '?', '[', ']', '{', '}', '(', ')'];

/** The directory a glob names before its first wildcard, and the text after its last one. */
function literalEnds(glob: string): { directory: string; ending: string } {
  const positions = WILDCARDS.flatMap((wildcard) => [
    glob.indexOf(wildcard),
    glob.lastIndexOf(wildcard),
  ]).filter((position) => position !== -1);
  if (positions.length === 0) return { directory: glob, ending: glob };

  const head = glob.slice(0, Math.min(...positions));
  return {
    directory: head.slice(0, head.lastIndexOf('/') + 1),
    ending: glob.slice(Math.max(...positions) + 1),
  };
}

/**
 * The tracked files a glob matches, worked out once per glob. `matchesGlob` compiles the glob on
 * every call, so it is asked only about the files under the glob's directory with its ending.
 */
function matchingGlob(glob: string): ReadonlySet<string> {
  let matched = globMatches.get(glob);
  if (matched === undefined) {
    const { directory, ending } = literalEnds(glob);
    matched = new Set(
      allTracked().filter(
        (file) => file.startsWith(directory) && file.endsWith(ending) && matchesGlob(file, glob)
      )
    );
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

let paths: ReadonlySet<string> | undefined;

/** Every tracked file and every directory above one: what a document may link to or name. */
export function trackedPaths(): ReadonlySet<string> {
  if (paths === undefined) {
    const found = new Set<string>();
    for (const file of allTracked()) {
      found.add(file);
      let directory = posix.dirname(file);
      while (directory !== '.' && !found.has(directory)) {
        found.add(directory);
        directory = posix.dirname(directory);
      }
    }
    paths = found;
  }
  return paths;
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

export function shrinkOnly(offenders: string[], allowed: readonly string[]) {
  return {
    unlisted: offenders.filter((file) => !allowed.includes(file)),
    stale: allowed.filter((file) => !offenders.includes(file)),
  };
}
