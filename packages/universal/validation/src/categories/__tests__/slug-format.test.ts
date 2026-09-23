import { isErr, isOk } from '@vp/result';
import { SLUG_MAX_LENGTH, validateSlug } from '../slug-format';

describe('@vp/validation: validateSlug', () => {
  it.each([{ slug: 'music' }, { slug: 'how-to-code' }, { slug: 'a1-b2-c3' }])(
    'accepts $slug',
    ({ slug }) => {
      expect(isOk(validateSlug(slug))).toBe(true);
    }
  );

  it.each([
    { slug: 'Music' },
    { slug: 'how_to_code' },
    { slug: '-leading' },
    { slug: 'trailing-' },
    { slug: 'double--dash' },
    { slug: '' },
    { slug: 'a'.repeat(SLUG_MAX_LENGTH + 1) },
  ])('rejects $slug', ({ slug }) => {
    expect(isErr(validateSlug(slug))).toBe(true);
  });
});
