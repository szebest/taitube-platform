import { THROWING_DOMAIN_SOURCES } from './throwing-domain-sources';
import { productionSources, read, shrinkOnly } from './repo-files';

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

function throwsOutsideAssertNever(file: string): boolean {
  const source = read(file);
  return [...source.matchAll(THROW)].some((match) => {
    const line = source.slice(match.index ?? 0).split('\n')[0] ?? '';
    return !ASSERT_NEVER.test(line);
  });
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

  it('holds the converted domain code free of throw', () => {
    const { unlisted } = shrinkOnly(offenders(), THROWING_DOMAIN_SOURCES);

    expect(unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that no longer throws', () => {
    const { stale } = shrinkOnly(offenders(), THROWING_DOMAIN_SOURCES);

    expect(stale).toEqual([]);
  });

  it('does not count a throw assertNever against a rule', () => {
    expect(throwsOutsideAssertNever('apps/api/src/routes/admin/categories.presenter.ts')).toBe(
      false
    );
  });
});
