import { LEGACY_CATCH_SITES, PENDING_CATCH_SITES } from './legacy-catch-sites';
import { productionSources, read, shrinkOnly } from './repo-files';

/**
 * `tryCatch` / `fromPromise` in `@vp/result` and the adapters that call them are where a throwing
 * SDK becomes a `Result`. Everywhere else a `catch` is control flow that cannot tell intent from
 * fault, which is what let `channel-service.ts` turn a dead database into a channel-less user.
 */
const CATCH_HOMES = [
  'packages/universal/result/',
  'packages/server/adapters/',
  'apps/api/src/app.ts',
  'apps/api/src/composition/',
  'apps/api/src/plugins/errors.ts',
  'apps/worker/src/runner.ts',
];

const CATCH = /(^|[^\w.])catch\s*[({]/;

function catchesOutsideItsHome(file: string): boolean {
  return !CATCH_HOMES.some((home) => file.startsWith(home)) && CATCH.test(read(file));
}

function offenders(): string[] {
  return productionSources().filter(catchesOutsideItsHome);
}

describe('architecture: catch is confined to the boundary that converts a throw', () => {
  it('still sees the catches the boundary legitimately makes', () => {
    expect(CATCH.test(read('packages/universal/result/src/try-catch.ts'))).toBe(true);
  });

  it('allows no new catch outside the boundary', () => {
    const { unlisted } = shrinkOnly(offenders(), LEGACY_CATCH_SITES);

    expect(unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that no longer catches', () => {
    const { stale } = shrinkOnly(offenders(), LEGACY_CATCH_SITES);

    expect(stale).toEqual([]);
  });

  /**
   * The out-of-scope half of the list cannot shrink through this ticket, so counting it as work
   * outstanding overstates what is left. This is the number that has to reach zero.
   */
  it('separates what this ticket still owes from what a later ticket has to claim', () => {
    expect(PENDING_CATCH_SITES.every((file) => LEGACY_CATCH_SITES.includes(file))).toBe(true);
    expect(PENDING_CATCH_SITES.length).toBeLessThan(LEGACY_CATCH_SITES.length);
  });
});
