import { execFileSync } from 'node:child_process';
import { matchesGlob } from 'node:path';
import { ROOT, trackedFiles } from './repo-files';

const TOP_LEVEL = new Set(trackedFiles().map((file) => file.split('/')[0] ?? ''));

/** `packages/<tier>/` and `{a,b}` name a set of paths; as a glob, each must match one. */
function asGlob(path: string): string {
  return path.replaceAll(/<[^>]+>/g, '*');
}

function pathOf(span: string): string | undefined {
  if (/\s/.test(span) || !span.includes('/')) return undefined;
  const path = span.replace(/[:#].*$/, '').replace(/\/$/, '');
  return TOP_LEVEL.has(path.split('/')[0] ?? '') ? path : undefined;
}

export function existsInRepo(path: string, paths: ReadonlySet<string>): boolean {
  const glob = asGlob(path);
  const wildcardAt = glob.search(/[*{]/);
  if (wildcardAt === -1) return paths.has(path);
  const literalPrefix = glob.slice(0, wildcardAt);
  return [...paths].some(
    (candidate) => candidate.startsWith(literalPrefix) && matchesGlob(candidate, glob)
  );
}

/** Paths git ignores are what a build or an install writes; a document may name them. */
function ignoredByGit(paths: readonly string[]): Set<string> {
  if (paths.length === 0) return new Set();
  try {
    const output = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: ROOT,
      encoding: 'utf8',
      input: paths.join('\n'),
    });
    return new Set(output.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

export interface CodeSpans {
  document: string;
  spans: readonly string[];
}

/** Each backticked repo path that names nothing tracked and nothing a build writes, as `document: path`. */
export function missingPaths(
  documents: readonly CodeSpans[],
  paths: ReadonlySet<string>
): string[] {
  const missing: { document: string; path: string }[] = [];
  for (const { document, spans } of documents) {
    for (const span of spans) {
      const path = pathOf(span);
      if (path !== undefined && !existsInRepo(path, paths)) missing.push({ document, path });
    }
  }
  const ignored = ignoredByGit(missing.map(({ path }) => path));
  return missing
    .filter(({ path }) => !ignored.has(path))
    .map(({ document, path }) => `${document}: ${path}`);
}
