import { directoryTier, isPlatform, type Pkg } from '../workspace-packages';
import type { Moves } from './moves';

/**
 * Where each whole-move package goes: `packages/<tier>/<name>` to `packages/platform/<tier>/<name>`.
 * A whole move is an entry whose destination is a string other than its own name.
 */
export function planDirMoves(
  packages: readonly Pkg[],
  moves: Moves,
  excluded: ReadonlySet<string> = new Set()
): Record<string, string> {
  const plan: Record<string, string> = {};
  for (const pkg of packages) {
    const move = moves[pkg.name];
    const tier = directoryTier(pkg.dir);
    if (typeof move !== 'string' || move === pkg.name || excluded.has(pkg.name)) continue;
    if (isPlatform(pkg.dir) || !tier || !pkg.dir.startsWith('packages/')) continue;
    plan[pkg.dir] = `packages/platform/${tier}/${pkg.dir.split('/').pop()}`;
  }
  return plan;
}

export function planScopeRenames(
  moves: Moves,
  selected: ReadonlySet<string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(moves).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1] !== entry[0] && selected.has(entry[0])
    )
  );
}
