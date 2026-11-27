import { expectErr, expectOk } from '@kit/testing/result';
import type { PlaylistInvite } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER } from '../../__tests__/entities';
import { decidePlaylistInviteAccept } from '../accept-playlist-invite.rule';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const link: PlaylistInvite & { ownerId: string } = {
  ownerId: OWNER.id,
  id: 'invite-1',
  playlistId: 'playlist-1',
  role: 'contributor',
  token: 't'.repeat(22),
  inviteeUserId: null,
  createdBy: OWNER.id,
  expiresAt: new Date('2026-12-01T00:00:00.000Z'),
  maxUses: 2,
  useCount: 0,
  revokedAt: null,
  createdAt: NOW,
};

function accept(overrides: Partial<Parameters<typeof decidePlaylistInviteAccept>[0]> = {}) {
  return decidePlaylistInviteAccept({
    user: STRANGER,
    invite: link,
    isCollaborator: false,
    seated: 0,
    now: NOW,
    ...overrides,
  });
}

describe('@vp/domain-rules: accepting a playlist invite', () => {
  it('seats the taker with the role the invite carries', () => {
    expect(expectOk(accept())).toEqual({ playlistId: 'playlist-1', role: 'contributor' });
  });

  it('lets the invitee take a personal invite', () => {
    expect(expectOk(accept({ invite: { ...link, inviteeUserId: STRANGER.id } })).role).toBe(
      'contributor'
    );
  });

  it.each([
    { scenario: 'an unknown token', overrides: { invite: null } },
    { scenario: 'an expired link', overrides: { invite: { ...link, expiresAt: NOW } } },
    { scenario: 'a revoked link', overrides: { invite: { ...link, revokedAt: NOW } } },
    { scenario: 'a used-up link', overrides: { invite: { ...link, useCount: 2 } } },
    {
      scenario: "someone else's invite",
      overrides: { invite: { ...link, inviteeUserId: 'someone' } },
    },
  ])('refuses $scenario as PLAYLIST_INVITE_INVALID', ({ overrides }) => {
    expect(expectErr(accept(overrides)).code).toBe(ErrorCodes.PLAYLIST_INVITE_INVALID);
  });

  it.each([
    { scenario: 'a seated collaborator', overrides: { isCollaborator: true }, code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS },
    { scenario: 'the owner', overrides: { user: OWNER }, code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS },
    { scenario: 'a full playlist', overrides: { seated: 20 }, code: ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT },
  ])('refuses $scenario with $code', ({ overrides, code }) => {
    expect(expectErr(accept(overrides)).code).toBe(code);
  });
});
