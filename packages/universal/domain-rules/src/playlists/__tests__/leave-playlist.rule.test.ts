import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { STRANGER, aPlaylist } from '../../__tests__/entities';
import { decidePlaylistLeave } from '../leave-playlist.rule';

describe('@vp/domain-rules: leaving a playlist', () => {
  it('lets a seated collaborator go', () => {
    const playlist = aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'contributor' });

    expect(
      expectOk(decidePlaylistLeave({ actor: STRANGER, playlist, playlistId: playlist.id }))
    ).toBe(playlist);
  });

  it.each([
    { scenario: 'an absent playlist', playlist: null, code: ErrorCodes.PLAYLIST_NOT_FOUND },
    {
      scenario: 'someone with no seat',
      playlist: aPlaylist(),
      code: ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND,
    },
  ])('refuses $scenario with $code', ({ playlist, code }) => {
    const result = decidePlaylistLeave({ actor: STRANGER, playlist, playlistId: 'playlist-1' });

    expect(expectErr(result).code).toBe(code);
  });
});
