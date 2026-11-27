import { dirname, posix } from 'node:path';

export interface ReferenceRules {
  readonly scopeRenames: Readonly<Record<string, string>>;
  readonly dirMoves: Readonly<Record<string, string>>;
}

const alternation = (names: readonly string[]): string =>
  [...names]
    .sort((a, b) => b.length - a.length)
    .map(RegExp.escape)
    .join('|');

const RELATIVE_TOKEN = /(?<=["'`(])(\.{1,2}\/[^"'`)\s]*)/g;

export function oldLocationOf(path: string, dirMoves: Readonly<Record<string, string>>): string {
  for (const [from, to] of Object.entries(dirMoves)) {
    if (path === to || path.startsWith(`${to}/`)) return `${from}${path.slice(to.length)}`;
  }
  return path;
}

export function newLocationOf(path: string, dirMoves: Readonly<Record<string, string>>): string {
  for (const [from, to] of Object.entries(dirMoves)) {
    if (path === from || path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  }
  return path;
}

function rewriteRelative(
  text: string,
  file: string,
  dirMoves: Readonly<Record<string, string>>
): string {
  const oldDir = dirname(oldLocationOf(file, dirMoves));
  const newDir = dirname(file);
  return text.replace(RELATIVE_TOKEN, (token) => {
    const trailing = token.endsWith('/') ? '/' : '';
    const target = posix.join(oldDir, token);
    const moved = newLocationOf(target, dirMoves);
    if (posix.join(newDir, token) === moved) return token;
    const relative = posix.relative(newDir, moved) || '.';
    const rewritten = relative.startsWith('.') ? relative : `./${relative}`;
    return rewritten + (rewritten.endsWith('/') ? '' : trailing);
  });
}

/**
 * Rewrites what an AST pass cannot reach: `@vp/x` to `@kit/x` wherever the name is written (manifests,
 * aliases, filters, docs), `packages/<tier>/<name>` to its new directory, and relative paths that
 * crossed a moved directory. `file` is the repository-relative path the text lives at now.
 */
export function rewriteReferences(text: string, file: string, rules: ReferenceRules): string {
  const names = Object.keys(rules.scopeRenames);
  const dirs = Object.keys(rules.dirMoves);

  const renamed =
    names.length === 0
      ? text
      : text.replace(
          new RegExp(`(?<![\\w@-])(${alternation(names)})(?![\\w-])`, 'g'),
          (name) => rules.scopeRenames[name] ?? name
        );

  const moved =
    dirs.length === 0
      ? renamed
      : renamed.replace(
          new RegExp(`(?<![\\w-])(${alternation(dirs)})(?![\\w-])`, 'g'),
          (dir) => rules.dirMoves[dir] ?? dir
        );

  return dirs.length === 0 ? moved : rewriteRelative(moved, file, rules.dirMoves);
}

const DEPENDENCY_BLOCKS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const sortedKeys = (block: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(block).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * A rename changes where a name sorts. The blocks are re-sorted only in manifests that
 * round-trip through `JSON.stringify(…, null, 2)` unchanged, so no other formatting is touched.
 */
export function sortManifestDependencies(before: string, after: string): string {
  if (after === before) return after;
  if (`${JSON.stringify(JSON.parse(before), null, 2)}\n` !== before) return after;
  const manifest = JSON.parse(after);
  for (const block of DEPENDENCY_BLOCKS) {
    if (manifest[block]) manifest[block] = sortedKeys(manifest[block]);
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
