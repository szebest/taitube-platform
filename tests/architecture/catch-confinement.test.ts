import { LEGACY_CATCH_SITES } from './legacy-catch-sites';
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
   * Nothing on the list is waiting on a conversion any more: ticket 84 converted every port,
   * service and stage, and what remains is the process, CLI, telemetry, build and browser
   * boundaries it named out of scope.
   */
  it('leaves only the boundaries a later ticket has to claim', () => {
    const roots = [
      'packages/server/ffmpeg/',
      'packages/server/gen-video/',
      'packages/server/dev-token/',
      'packages/server/upload-client/',
      'packages/server/compose-autoscaler/',
      'packages/server/observability/',
      'packages/server/db/',
      'apps/web/',
      'scripts/',
      'apps/api/src/plugins/',
      'apps/api/src/migrate.ts',
      'apps/worker/src/main.ts',
      'apps/worker/src/with-telemetry.ts',
      'apps/worker/src/failure-handler.ts',
    ];

    expect(LEGACY_CATCH_SITES.filter((file) => !roots.some((r) => file.startsWith(r)))).toEqual([]);
  });
});
