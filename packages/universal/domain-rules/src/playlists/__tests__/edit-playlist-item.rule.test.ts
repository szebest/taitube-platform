import { expectErr, expectOk } from '@kit/testing/result';
import type { PlaylistItemPatch, StoredPlaylistItem } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import { decidePlaylistItemEdit } from '../edit-playlist-item.rule';

const playlist = aPlaylist();
const video: StoredPlaylistItem = {
  id: 'item-1',
  kind: 'video',
  videoId: 'video-1',
  title: null,
  addedBy: OWNER.id,
  note: null,
  startMs: null,
  endMs: null,
  position: 0,
};
const section: StoredPlaylistItem = { ...video, kind: 'section', videoId: null, title: 'Part 1' };

function edit(patch: PlaylistItemPatch, item: StoredPlaylistItem | null = video, durationMs: number | null = 60_000) {
  return decidePlaylistItemEdit({
    actor: OWNER,
    playlist,
    playlistId: playlist.id,
    itemId: 'item-1',
    item,
    patch,
    durationMs,
  });
}

describe('@vp/domain-rules: editing an item', () => {
  it.each([
    { scenario: 'a note', patch: { note: ' Start here ' }, expected: { note: 'Start here' } },
    { scenario: 'a cleared note', patch: { note: '' }, expected: { note: null } },
    { scenario: 'a segment', patch: { startMs: 1000, endMs: 30_000 }, expected: { startMs: 1000, endMs: 30_000 } },
    { scenario: 'an open-ended start', patch: { startMs: 59_000 }, expected: { startMs: 59_000 } },
    { scenario: 'a cleared segment', patch: { startMs: null, endMs: null }, expected: { startMs: null, endMs: null } },
  ])('keeps $scenario', ({ patch, expected }) => {
    expect(expectOk(edit(patch))).toEqual(expected);
  });

  it.each([
    { scenario: 'a segment under a second', patch: { startMs: 1000, endMs: 1500 }, field: 'endMs' },
    { scenario: 'an end past the video', patch: { endMs: 61_000 }, field: 'endMs' },
    { scenario: 'a start past the video', patch: { startMs: 60_000 }, field: 'startMs' },
    { scenario: 'a start too close to the end', patch: { startMs: 59_500 }, field: 'endMs' },
    { scenario: 'a negative start', patch: { startMs: -1 }, field: 'startMs' },
    { scenario: 'a title on a video', patch: { title: 'x' }, field: 'title' },
    { scenario: 'a note over 300 characters', patch: { note: 'n'.repeat(301) }, field: 'note' },
  ])('refuses $scenario on $field', ({ patch, field }) => {
    expect(expectErr(edit(patch))).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field });
  });

  it.each([
    { patch: { title: ' Part 2 ' }, expected: { title: 'Part 2' }, field: null },
    { patch: { note: 'x' }, expected: null, field: 'note' },
    { patch: { startMs: 0 }, expected: null, field: 'startMs' },
  ])('takes $patch on a section', ({ patch, expected, field }) => {
    const result = edit(patch, section, null);

    expect(result.ok ? result.value : result.error).toMatchObject(expected ?? { field });
  });

  it('answers an absent item as PLAYLIST_ITEM_NOT_FOUND', () => {
    expect(expectErr(edit({ note: 'x' }, null)).code).toBe(ErrorCodes.PLAYLIST_ITEM_NOT_FOUND);
  });

  it.each([
    { addedBy: STRANGER.id, code: null },
    { addedBy: OWNER.id, code: ErrorCodes.FORBIDDEN },
  ])('lets a contributor annotate an item added by $addedBy: $code', ({ addedBy, code }) => {
    const result = decidePlaylistItemEdit({
      actor: STRANGER,
      playlist: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'contributor' }),
      playlistId: playlist.id,
      itemId: 'item-1',
      item: { ...video, addedBy },
      patch: { note: 'mine' },
      durationMs: 60_000,
    });

    expect(result.ok ? null : result.error.code).toBe(code);
  });
});
