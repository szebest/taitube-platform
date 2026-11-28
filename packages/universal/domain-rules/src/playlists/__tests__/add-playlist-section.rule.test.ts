import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aPlaylist } from '../../__tests__/entities';
import { decidePlaylistSectionAdd } from '../add-playlist-section.rule';

const playlist = aPlaylist();

describe('@vp/domain-rules: adding a section', () => {
  it('keeps the trimmed title', () => {
    const result = decidePlaylistSectionAdd({
      actor: OWNER,
      playlist,
      playlistId: playlist.id,
      title: '  Week one ',
    });

    expect(expectOk(result)).toEqual({ title: 'Week one' });
  });

  it.each([
    {
      scenario: 'a blank title',
      actor: OWNER,
      target: playlist,
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      scenario: 'a contributor',
      actor: STRANGER,
      target: aPlaylist({ collaboratorId: STRANGER.id, collaboratorRole: 'contributor' }),
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $scenario with $code', ({ actor, target, code }) => {
    const result = decidePlaylistSectionAdd({
      actor,
      playlist: target,
      playlistId: target.id,
      title: actor === OWNER ? ' ' : 'Week one',
    });

    expect(expectErr(result).code).toBe(code);
  });
});
