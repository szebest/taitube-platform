import { addToWatchPartyQueue } from '../watch-party-queue';

describe('packages/api-contracts: the watch party queue', () => {
  it.each([
    {
      scenario: 'a video from a start',
      body: { videoId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', startMs: 1000 },
      ok: true,
    },
    {
      scenario: 'a playlist',
      body: { playlistId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' },
      ok: true,
    },
    { scenario: 'nothing', body: {}, ok: false },
  ])('adds $scenario: $ok', ({ body, ok }) => {
    expect(addToWatchPartyQueue.body.safeParse(body).success).toBe(ok);
  });
});
