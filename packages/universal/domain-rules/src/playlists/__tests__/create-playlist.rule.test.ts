import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { STRANGER } from '../../__tests__/entities';
import { decidePlaylistCreate } from '../create-playlist.rule';

describe('@vp/domain-rules: decidePlaylistCreate', () => {
  it('defaults a new playlist to private with no description', () => {
    const result = decidePlaylistCreate({ actor: STRANGER, title: ' Mix ' });

    expect(isOk(result) && result.value).toEqual({
      title: 'Mix',
      description: '',
      visibility: 'private',
    });
  });

  it('keeps the visibility and description asked for', () => {
    const result = decidePlaylistCreate({
      actor: STRANGER,
      title: 'Mix',
      description: 'songs',
      visibility: 'unlisted',
    });

    expect(isOk(result) && result.value).toEqual({
      title: 'Mix',
      description: 'songs',
      visibility: 'unlisted',
    });
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, title: 'Mix', code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a blank title', actor: STRANGER, title: ' ', code: ErrorCodes.VALIDATION_FAILED },
  ])('refuses $scenario with $code', ({ actor, title, code }) => {
    const result = decidePlaylistCreate({ actor, title });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
