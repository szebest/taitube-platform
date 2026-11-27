import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import { decidePlaylistInvite, decidePlaylistLinkInvite } from '../playlist-invite.rule';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const playlist = aPlaylist();
const base = {
  actor: OWNER,
  playlist,
  playlistId: playlist.id,
  role: 'editor' as const,
  id: 'invite-1',
  token: 't'.repeat(22),
  now: NOW,
  seated: 0,
};

function personal(overrides: Partial<Parameters<typeof decidePlaylistInvite>[0]> = {}) {
  return decidePlaylistInvite({
    ...base,
    handle: 'friend',
    invitee: { userId: STRANGER.id },
    isCollaborator: false,
    ...overrides,
  });
}

describe('@vp/domain-rules: playlist invites', () => {
  it('sends a single-use personal invite that lasts a week', () => {
    expect(expectOk(personal())).toMatchObject({
      playlistId: playlist.id,
      inviteeUserId: STRANGER.id,
      maxUses: 1,
      useCount: 0,
      createdBy: OWNER.id,
      expiresAt: new Date('2026-12-03T12:00:00.000Z'),
    });
  });

  it.each([
    {
      scenario: 'an unknown handle',
      overrides: { invitee: null },
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    {
      scenario: 'a collaborator already seated',
      overrides: { isCollaborator: true },
      code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
    },
    {
      scenario: 'the owner',
      overrides: { invitee: { userId: OWNER.id } },
      code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
    },
    {
      scenario: 'a full playlist',
      overrides: { seated: 20 },
      code: ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT,
    },
    {
      scenario: 'an editor inviting',
      overrides: {
        actor: STRANGER,
        playlist: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'editor' }),
      },
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ overrides, code }) => {
    expect(expectErr(personal(overrides)).code).toBe(code);
  });

  it.each([
    { expiresInDays: undefined, maxUses: null, expiresAt: '2026-12-03T12:00:00.000Z' },
    { expiresInDays: 30, maxUses: 5, expiresAt: '2026-12-26T12:00:00.000Z' },
  ])(
    'opens a link for $expiresInDays days and $maxUses uses',
    ({ expiresInDays, maxUses, expiresAt }) => {
      const link = expectOk(decidePlaylistLinkInvite({ ...base, expiresInDays, maxUses }));

      expect(link).toMatchObject({ inviteeUserId: null, maxUses, expiresAt: new Date(expiresAt) });
    }
  );

  it('opens no link on a full playlist', () => {
    const result = decidePlaylistLinkInvite({
      ...base,
      seated: 20,
      expiresInDays: 7,
      maxUses: null,
    });

    expect(expectErr(result).code).toBe(ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT);
  });
});
