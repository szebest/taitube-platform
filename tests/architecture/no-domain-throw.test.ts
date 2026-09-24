import { productionSources, read } from './repo-files';

/**
 * Layers 1 and 2 return their failures (SDD ADR-24). The only `throw` they may reach is
 * `assertNever`, which fires on a variant the compiler already proved unreachable.
 */
const DOMAIN_ROOTS = [
  'packages/universal/validation/',
  'packages/universal/domain-rules/',
  'packages/server/core/',
  'apps/api/src/services/',
  'apps/worker/src/stages/',
];

const THROW = /(^|[^\w.])throw\s+/g;
const ASSERT_NEVER = /(^|[^\w.])throw\s+assertNever\b/;

/**
 * A helper that turns a `Result` into a throw is the same escape hatch one indirection away, and
 * the literal-`throw` sweep cannot see it: `unwrapOrThrow` has a capital T and word characters to
 * its left, so it matched neither half of `THROW`. This matches the shape rather than the one
 * name, so the next `assertOrThrow` is caught the day it is written.
 */
const CONVERTS_TO_THROW = /\b\w+OrThrow\s*\(/g;

/**
 * `Schema.parse(...)` and `JSON.parse(...)` throw on bad input just as a `throw` would. The domain
 * reads a schema through `safeParse` and JSON through `parseJson`, which answer with a value.
 */
const THROWING_PARSE = /\b[A-Z]\w*\.parse\(/g;

function throwSites(source: string): string[] {
  const sites = [...source.matchAll(THROW)]
    .map((match) => source.slice(match.index ?? 0).split('\n')[0] ?? '')
    .filter((line) => !ASSERT_NEVER.test(line));

  return [
    ...sites,
    ...[...source.matchAll(CONVERTS_TO_THROW)].map(([hit]) => hit),
    ...[...source.matchAll(THROWING_PARSE)].map(([hit]) => hit),
  ];
}

function throwsOutsideAssertNever(file: string): boolean {
  return throwSites(read(file)).length > 0;
}

function offenders(): string[] {
  return productionSources()
    .filter((file) => DOMAIN_ROOTS.some((root) => file.startsWith(root)))
    .filter(throwsOutsideAssertNever);
}

describe('architecture: domain code returns its failures, it does not throw them', () => {
  it('reads the trees it is asserting about', () => {
    const covered = productionSources().filter((file) =>
      DOMAIN_ROOTS.some((root) => file.startsWith(root))
    );

    expect(covered.length).toBeGreaterThan(50);
  });

  it('finds no rule, service or stage that throws its failure', () => {
    expect(offenders()).toEqual([]);
  });

  it.each([
    { shape: 'a bare throw', source: 'throw new PermanentError("x");' },
    { shape: 'a throw after a return', source: 'if (!row) throw notFound(id);' },
    {
      shape: 'a Result unwrapped into a throw',
      source: 'const v = unwrapOrThrow(await repo.f());',
    },
    { shape: 'the same helper under another name', source: 'const v = okOrThrow(result);' },
    { shape: 'a zod parse', source: 'const data = NotifyJob.parse({ videoId });' },
    { shape: 'a JSON parse', source: 'const page = JSON.parse(raw) as Page;' },
  ])('counts $shape against a domain source', ({ source }) => {
    expect(throwSites(source)).not.toEqual([]);
  });

  it.each([
    { shape: 'an exhaustiveness assertion', source: 'throw assertNever(failure, "present");' },
    { shape: 'a property named after a throw', source: 'const x = e.throwSite;' },
    { shape: 'a returned failure', source: 'return err(databaseUnavailable("findById"));' },
    { shape: 'a safe parse', source: 'const parsed = SseMessageEnvelope.safeParse(json);' },
  ])('leaves $shape alone', ({ source }) => {
    expect(throwSites(source)).toEqual([]);
  });

  it('does not count a throw assertNever against a rule', () => {
    expect(throwsOutsideAssertNever('apps/api/src/routes/admin/categories.presenter.ts')).toBe(
      false
    );
  });
});
