import { expectErr, expectOk } from '@kit/testing/result';
import type { PlaylistActivity } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import { decidePlaylistRestore } from '../restore-playlist-item.rule';

const playlist = aPlaylist();
const at = { id: 'a-1', playlistId: playlist.id, actorUserId: STRANGER.id, createdAt: new Date(0) };
const removed: PlaylistActivity = {
  ...at,
  action: 'item_removed',
  target: {
    itemId: 'i',
    videoId: 'v',
    title: null,
    addedBy: null,
    note: null,
    startMs: null,
    endMs: null,
  },
};

function restore(overrides: Partial<Parameters<typeof decidePlaylistRestore>[0]> = {}) {
  return decidePlaylistRestore({
    actor: OWNER,
    playlist,
    playlistId: playlist.id,
    activityId: 'a-1',
    activity: removed,
    ...overrides,
  });
}

describe('@vp/domain-rules: restoring a removed item', () => {
  it('hands the owner the removal to undo', () => {
    expect(expectOk(restore())).toBe(removed);
  });

  it.each([
    {
      scenario: 'an unknown change',
      overrides: { activity: null },
      code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND,
    },
    {
      scenario: "another playlist's change",
      overrides: { activity: { ...removed, playlistId: 'other' } },
      code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND,
    },
    {
      scenario: 'a reorder',
      overrides: { activity: { ...at, action: 'items_reordered' as const, target: { count: 3 } } },
      code: ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE,
    },
    {
      scenario: 'an editor',
      overrides: {
        actor: STRANGER,
        playlist: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'editor' }),
      },
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ overrides, code }) => {
    expect(expectErr(restore(overrides)).code).toBe(code);
  });
});
