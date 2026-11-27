import { expectErr, expectOk } from '@kit/testing/result';
import type { StoredPlaylistItem } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import {
  decidePlaylistTransfer,
  decidePlaylistTransferItem,
} from '../transfer-playlist-items.rule';

const source = aPlaylist({ id: 'source', ownerId: OWNER.id });
const item: StoredPlaylistItem = {
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

describe('@vp/domain-rules: moving and copying items', () => {
  it('lets a reader of the source copy into a playlist of their own', () => {
    const target = aPlaylist({ id: 'target', ownerId: STRANGER.id });
    const result = decidePlaylistTransfer({
      actor: STRANGER,
      source: { ...source, visibility: 'public' },
      sourceId: 'source',
      target,
      targetId: 'target',
      mode: 'copy',
    });

    expect(expectOk(result).target).toBe(target);
  });

  it.each([
    { scenario: 'a private source', source, target: aPlaylist({ ownerId: STRANGER.id }), code: ErrorCodes.PLAYLIST_NOT_FOUND },
    {
      scenario: "someone else's public target",
      source: { ...source, visibility: 'public' as const },
      target: aPlaylist({ id: 'target', visibility: 'public' }),
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ source: from, target, code }) => {
    const result = decidePlaylistTransfer({
      actor: STRANGER,
      source: from,
      sourceId: from.id,
      target,
      targetId: target.id,
      mode: 'copy',
    });

    expect(expectErr(result).code).toBe(code);
  });

  const contributor = aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'contributor' });

  it.each([
    { scenario: 'copies any item', mode: 'copy' as const, held: item, code: null },
    { scenario: 'moves their own item', mode: 'move' as const, held: { ...item, addedBy: STRANGER.id }, code: null },
    { scenario: "moves someone else's item", mode: 'move' as const, held: item, code: ErrorCodes.FORBIDDEN },
    { scenario: 'names an absent item', mode: 'copy' as const, held: null, code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND },
  ])('a contributor $scenario: $code', ({ mode, held, code }) => {
    const result = decidePlaylistTransferItem({
      actor: STRANGER,
      source: contributor,
      itemId: 'item-1',
      item: held,
      mode,
    });

    expect(result.ok ? null : result.error.code).toBe(code);
  });
});
