import {
  MAX_PLAYLIST_COLLABORATORS,
  playlistAudience,
  playlistInviteExpiresAt,
  playlistInviteState,
  playlistUpdateHour,
} from '../playlist-collaboration';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const LATER = new Date('2026-11-27T12:00:00.000Z');
const EARLIER = new Date('2026-11-25T12:00:00.000Z');

describe('@vp/domain: playlist collaboration', () => {
  it('holds up to 20 collaborators', () => {
    expect(MAX_PLAYLIST_COLLABORATORS).toBe(20);
  });

  it.each([
    { scenario: 'a live link', fields: {}, state: 'active' },
    { scenario: 'a link with uses left', fields: { maxUses: 2, useCount: 1 }, state: 'active' },
    { scenario: 'a used-up link', fields: { maxUses: 2, useCount: 2 }, state: 'exhausted' },
    { scenario: 'a link past its date', fields: { expiresAt: EARLIER }, state: 'expired' },
    {
      scenario: 'a revoked link past its date',
      fields: { expiresAt: EARLIER, revokedAt: EARLIER },
      state: 'revoked',
    },
    {
      scenario: 'an expired used-up link',
      fields: { expiresAt: NOW, maxUses: 1, useCount: 1 },
      state: 'expired',
    },
  ])('reads $scenario as $state', ({ fields, state }) => {
    const invite = { expiresAt: LATER, revokedAt: null, maxUses: null, useCount: 0, ...fields };

    expect(playlistInviteState(invite, NOW)).toBe(state);
  });

  it('ends an invite the given number of days on', () => {
    expect(playlistInviteExpiresAt(7, NOW).toISOString()).toBe('2026-12-03T12:00:00.000Z');
  });

  it.each([
    { scenario: 'a collaborator acts', actor: 'b', heard: ['owner', 'c'] },
    { scenario: 'the owner acts', actor: 'owner', heard: ['b', 'c'] },
  ])('tells everyone else when $scenario', ({ actor, heard }) => {
    expect(playlistAudience('owner', ['b', 'c'], actor)).toEqual(heard);
  });

  it('groups changes by the UTC hour', () => {
    expect(playlistUpdateHour(new Date('2026-11-26T12:59:59.999Z'))).toBe('2026-11-26T12');
  });
});
