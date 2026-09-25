import { ErrorCodes, isInputFailure } from '@vp/errors';
import { playlistItemNotFound, playlistNotFound, systemPlaylistImmutable } from '../failures';

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
  ])('$name carries $code and the playlist id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, playlistId: 'p1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});
