import { createWatchParty, getWatchPartyRoster, updateWatchParty } from '../watch-parties';

describe('packages/api-contracts: watch parties', () => {
  it.each([
    {
      scenario: 'a quick party from a video',
      body: {
        visibility: 'unlisted',
        preset: 'friends',
        source: { videoId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', startMs: 4000 },
      },
      ok: true,
    },
    {
      scenario: 'a party from a playlist',
      body: {
        visibility: 'public',
        preset: 'public',
        source: { playlistId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' },
      },
      ok: true,
    },
    {
      scenario: 'a party from the local queue',
      body: {
        visibility: 'unlisted',
        preset: 'friends',
        source: { videoIds: ['0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'], startIndex: 0 },
      },
      ok: true,
    },
    { scenario: 'no preset', body: { visibility: 'unlisted' }, ok: false },
    {
      scenario: 'a slow mode off the list',
      body: { visibility: 'unlisted', preset: 'friends', slowModeSeconds: 7 },
      ok: false,
    },
    {
      scenario: 'an accent that is no colour',
      body: { visibility: 'unlisted', preset: 'friends', accent: 'red' },
      ok: false,
    },
  ])('takes a create of $scenario: $ok', ({ body, ok }) => {
    expect(createWatchParty.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { scenario: 'a password cleared', body: { password: null, version: 3 }, ok: true },
    { scenario: 'a change without the version read', body: { name: 'Movie night' }, ok: false },
  ])('takes an edit of $scenario: $ok', ({ body, ok }) => {
    expect(updateWatchParty.body.safeParse(body).success).toBe(ok);
  });

  it('answers a non-member with the preview and a member with the roster', () => {
    const preview = {
      view: 'preview',
      preview: { faces: [], others: 0, discord: 0, guests: 2, total: 2 },
    };

    expect(getWatchPartyRoster.result.safeParse(preview).success).toBe(true);
    expect(getWatchPartyRoster.result.safeParse({ view: 'members', guests: 2 }).success).toBe(
      false
    );
  });
});
