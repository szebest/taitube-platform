import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import {
  playlistActivityNotFound,
  playlistActivityNotRestorable,
  playlistCollaboratorExists,
  playlistCollaboratorLimit,
  playlistCollaboratorNotFound,
  playlistInviteInvalid,
  playlistHasCollaborators,
  playlistIsSmart,
  playlistItemNotFound,
  playlistNotFound,
  playlistNotSmart,
  playlistPinLimit,
  systemPlaylistImmutable,
} from '../failures';

describe('@vp/domain-rules: playlist failures', () => {
  it.each([
    {
      name: 'playlistNotFound',
      failure: playlistNotFound('p1'),
      code: ErrorCodes.PLAYLIST_NOT_FOUND,
    },
    {
      name: 'playlistItemNotFound',
      failure: playlistItemNotFound('p1', 'i1'),
      code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
    },
    {
      name: 'systemPlaylistImmutable',
      failure: systemPlaylistImmutable('p1'),
      code: ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    },
    {
      name: 'playlistCollaboratorExists',
      failure: playlistCollaboratorExists('p1', 'u1'),
      code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
    },
    {
      name: 'playlistCollaboratorLimit',
      failure: playlistCollaboratorLimit('p1'),
      code: ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT,
    },
    {
      name: 'playlistCollaboratorNotFound',
      failure: playlistCollaboratorNotFound('p1', 'u1'),
      code: ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND,
    },
    {
      name: 'playlistActivityNotFound',
      failure: playlistActivityNotFound('p1', 'a1'),
      code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND,
    },
    { name: 'playlistIsSmart', failure: playlistIsSmart('p1'), code: ErrorCodes.PLAYLIST_IS_SMART },
    {
      name: 'playlistNotSmart',
      failure: playlistNotSmart('p1'),
      code: ErrorCodes.PLAYLIST_NOT_SMART,
    },
    {
      name: 'playlistHasCollaborators',
      failure: playlistHasCollaborators('p1'),
      code: ErrorCodes.PLAYLIST_HAS_COLLABORATORS,
    },
    {
      name: 'playlistPinLimit',
      failure: playlistPinLimit('p1'),
      code: ErrorCodes.PLAYLIST_PIN_LIMIT,
    },
  ])('$name carries $code and the playlist id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, playlistId: 'p1' });
    expect(isInputFailure(failure)).toBe(false);
  });

  it.each([
    { failure: playlistInviteInvalid(), code: ErrorCodes.PLAYLIST_INVITE_INVALID },
    {
      failure: playlistActivityNotRestorable('a1'),
      code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE,
    },
  ])('$code stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });
});
