import {
  clearWatchHistory,
  getWatchProgress,
  listWatchHistory,
  recordWatchProgress,
  removeWatchHistoryEntry,
} from '../watch-history';

const VIDEO = '00000000-0000-7000-8000-00000000c0de';

describe('packages/api-contracts: watch history', () => {
  it.each([
    { endpoint: recordWatchProgress, method: 'POST', path: '/v1/me/history' },
    { endpoint: listWatchHistory, method: 'GET', path: '/v1/me/history' },
    { endpoint: clearWatchHistory, method: 'DELETE', path: '/v1/me/history' },
    { endpoint: getWatchProgress, method: 'GET', path: '/v1/me/history/:videoId' },
    { endpoint: removeWatchHistoryEntry, method: 'DELETE', path: '/v1/me/history/:videoId' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it('writes a playhead through unless it is a heartbeat', () => {
    const body = recordWatchProgress.body.parse({
      videoId: VIDEO,
      progressSeconds: 45,
      durationSeconds: 600,
    });

    expect(body.reason).toBe('pause');
  });

  it.each([
    { name: 'a negative playhead', progressSeconds: -1, durationSeconds: 600 },
    { name: 'a zero duration', progressSeconds: 0, durationSeconds: 0 },
    { name: 'a fractional second', progressSeconds: 1.5, durationSeconds: 600 },
  ])('refuses $name', ({ progressSeconds, durationSeconds }) => {
    expect(
      recordWatchProgress.body.safeParse({ videoId: VIDEO, progressSeconds, durationSeconds })
        .success
    ).toBe(false);
  });
});
