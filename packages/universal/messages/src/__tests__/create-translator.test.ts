import type { MessageKey } from '../catalogue';
import { dt } from '../define';
import { translatorFor } from './fixtures';

const swedish = {
  videos: {
    views: dt('{count:plural}', {
      plural: { count: { one: '{?} visning', other: '{?} visningar' } },
    }),
  },
};

describe('@vp/messages: createTranslator', () => {
  it.each([
    { count: 1, expected: '1 view' },
    { count: 2, expected: '2 views' },
  ])('renders $count in the en catalogue', ({ count, expected }) => {
    expect(translatorFor('en').t('videos.views', { count })).toEqual({ ok: true, value: expected });
  });

  it('walks sv-FI to sv and finds the translation', () => {
    const { t } = translatorFor('sv-FI', { sv: swedish });

    expect(t('videos.views', { count: 2 })).toEqual({ ok: true, value: '2 visningar' });
  });

  it('falls back to en per key, so a partial catalogue still resolves', () => {
    const { t } = translatorFor('sv-FI', { sv: swedish });

    expect(t('videos.categories', { names: ['Musik', 'Sport'] })).toEqual({
      ok: true,
      value: 'In Musik och Sport',
    });
  });

  it('renders a message that takes no arguments with none', () => {
    expect(translatorFor('en').t('errors.forbidden')).toEqual({
      ok: true,
      value: 'You are not allowed to do that.',
    });
  });

  it('fails with the key when no catalogue on the chain has it, rather than throwing or blanking', () => {
    const missing = translatorFor('sv-FI').t('videos.gone' as MessageKey, { count: 1 } as never);

    expect(missing).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'FORMAT_UNRENDERABLE', key: 'videos.gone' }),
    });
  });

  it.each([
    { scenario: 'renders', key: 'videos.views' as const, expected: '3 views' },
    { scenario: 'falls back', key: 'videos.gone' as MessageKey, expected: 'fallback' },
  ])('tOr $scenario', ({ key, expected }) => {
    expect(translatorFor('en').tOr(key, { count: 3 } as never, 'fallback')).toBe(expected);
  });

  it('keeps working on a locale tag it cannot parse, from the fallback catalogue', () => {
    const rendered = translatorFor('not a locale').t('errors.forbidden');

    expect(rendered).toEqual({ ok: true, value: 'You are not allowed to do that.' });
  });
});
