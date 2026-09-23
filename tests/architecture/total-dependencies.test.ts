import { productionSources, read } from './repo-files';

const ROOTS = ['apps/api/src/services/', 'apps/worker/src/stages/'];

/** A collaborator the composition root forgot is a compile error, never a fallback built here. */
const RECOVERY = [/(?:\?\?|\|\|)\s*new\s+[A-Z]\w*/, /\?\?\s*default[A-Z]\w*/];

function recoversFromAMissingDependency(source: string): boolean {
  return RECOVERY.some((pattern) => pattern.test(source));
}

describe('architecture: a service or stage never invents a dependency it was not handed', () => {
  it.each([
    {
      scenario: 'a defaulted paginator',
      line: 'this.paginator = deps.paginator ?? defaultPaginator;',
    },
    {
      scenario: 'a constructed adapter',
      line: 'this.auth = deps.authorization ?? new CaslAuthorizationAdapter();',
    },
    { scenario: 'an or-constructed map', line: 'this.queues = deps.queues || new Map();' },
  ])('recognises $scenario', ({ line }) => {
    expect(recoversFromAMissingDependency(line)).toBe(true);
  });

  it('leaves a defaulted tuning value alone', () => {
    expect(recoversFromAMissingDependency('const ttl = deps.ttlSeconds ?? 3600;')).toBe(false);
  });

  it('finds no service or stage that recovers from a missing dependency', () => {
    const offenders = productionSources()
      .filter((file) => ROOTS.some((root) => file.startsWith(root)))
      .filter((file) => recoversFromAMissingDependency(read(file)));

    expect(offenders).toEqual([]);
  });
});
