import { useWatchProgress } from '../use-watch-progress';

const WATCHED_AT = '2026-01-02T00:00:00.000Z';

describe('apps/client/web: useWatchProgress', () => {
  it.each([
    { scenario: 'half way through', durationMs: 200_000, progressSeconds: 100, shown: 0.5 },
    { scenario: 'past a stale duration', durationMs: 100_000, progressSeconds: 120, shown: 1 },
    { scenario: 'not started', durationMs: 200_000, progressSeconds: 0, shown: undefined },
    {
      scenario: 'of no known duration',
      durationMs: undefined,
      progressSeconds: 30,
      shown: undefined,
    },
  ])('reads a video $scenario as $shown', ({ durationMs, progressSeconds, shown }) => {
    expect(
      useWatchProgress({ durationMs, viewer: { progressSeconds, watchedAt: WATCHED_AT } })
    ).toBe(shown);
  });

  it.each([
    { scenario: 'a guest', viewer: undefined },
    { scenario: 'a member who never watched it', viewer: null },
  ])('shows no bar to $scenario', ({ viewer }) => {
    expect(useWatchProgress({ durationMs: 200_000, viewer })).toBeUndefined();
  });
});
