import { isPlatform, type Pkg } from '../workspace-packages';

export type Edges = 'runtime' | 'all';

export type Closure =
  | { readonly ok: true; readonly packages: readonly Pkg[] }
  | { readonly ok: false; readonly problems: readonly string[] };

/**
 * Every platform package `roots` reach through their manifests, the roots included, in workspace
 * order. `runtime` follows dependencies and peers, what an installed tarball needs; `all` adds the
 * dev edges, what typechecking and testing the package needs. An edge to a package outside the
 * platform, or to no package at all, is a problem: nothing outside the closure is copied.
 */
export function platformClosure(
  roots: readonly string[],
  packages: readonly Pkg[],
  edges: Edges
): Closure {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const reached = new Set<string>();
  const problems: string[] = [];
  const pending = roots.map((name) => ({ name, from: 'the command line' }));

  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { name, from } = next;
    if (reached.has(name)) continue;
    const pkg = byName.get(name);
    if (pkg === undefined) {
      problems.push(`${from} names ${name}, which is no workspace package`);
      continue;
    }
    if (!isPlatform(pkg.dir)) {
      problems.push(`${from} depends on ${name}, which lives outside packages/platform`);
      continue;
    }
    reached.add(name);
    for (const dep of pkg.deps) {
      if (edges === 'all' || !dep.dev) pending.push({ name: dep.name, from: name });
    }
  }

  if (problems.length > 0) return { ok: false, problems: [...new Set(problems)].sort() };
  return { ok: true, packages: packages.filter((pkg) => reached.has(pkg.name)) };
}
