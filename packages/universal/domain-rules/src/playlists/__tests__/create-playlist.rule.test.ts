import { isErr, isOk } from '@kit/result';
import type { SmartPlaylistRules } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { STRANGER } from '../../__tests__/entities';
import { decidePlaylistCreate } from '../create-playlist.rule';

const RULES: SmartPlaylistRules = {
  match: 'all',
  conditions: [{ field: 'unwatched' }],
  sort: 'newest',
  limit: 20,
};

describe('@vp/domain-rules: decidePlaylistCreate', () => {
  it('defaults a new playlist to private with no description', () => {
    const result = decidePlaylistCreate({ actor: STRANGER, title: ' Mix ' });

    expect(isOk(result) && result.value).toEqual({
      title: 'Mix',
      description: '',
      visibility: 'private',
      kind: 'playlist',
      rules: null,
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
      kind: 'playlist',
      rules: null,
    });
  });

  it('makes a series when asked', () => {
    const result = decidePlaylistCreate({ actor: STRANGER, title: 'Season 1', kind: 'series' });

    expect(isOk(result) && result.value.kind).toBe('series');
  });

  it('makes a smart playlist from its rules', () => {
    const result = decidePlaylistCreate({ actor: STRANGER, title: 'Fresh', rules: RULES });

    expect(isOk(result) && result.value.rules).toEqual(RULES);
  });

  it.each([
    { scenario: 'an anonymous caller', actor: null, title: 'Mix', code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'a blank title', actor: STRANGER, title: ' ', code: ErrorCodes.VALIDATION_FAILED },
    {
      scenario: 'a smart series',
      actor: STRANGER,
      title: 'Mix',
      kind: 'series' as const,
      rules: RULES,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $scenario with $code', ({ actor, title, code, ...rest }) => {
    const result = decidePlaylistCreate({ actor, title, ...rest });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
