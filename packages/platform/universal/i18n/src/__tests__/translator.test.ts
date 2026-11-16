import { builtInKinds } from '../kinds';
import { createTranslator } from '../translator';
import { catalogues, intlFor, presets, type source } from './fixtures';

const kinds = new Map(builtInKinds.map((kind) => [kind.name, kind]));

const translatorFor = (locale: string) =>
  createTranslator<typeof source>({ intl: intlFor(locale), catalogues, kinds, presets });

describe('@kit/i18n: createTranslator', () => {
  it.each([
    { count: 1, expected: '1 view' },
    { count: 2_500, expected: '2.5K views' },
  ])('renders $count from the source catalogue', ({ count, expected }) => {
    expect(translatorFor('en').t('videos.views', { count })).toEqual({ ok: true, value: expected });
  });

  it('walks sv-FI to sv and finds the translation', () => {
    expect(translatorFor('sv-FI').t('videos.views', { count: 2 })).toEqual({
      ok: true,
      value: '2 visningar',
    });
  });

  it('falls back to the source per key, so a partial translation still resolves', () => {
    expect(translatorFor('sv-FI').t('videos.categories', { names: ['Musik', 'Sport'] })).toEqual({
      ok: true,
      value: 'In Musik och Sport',
    });
  });

  it('renders a message that takes no arguments with none', () => {
    expect(translatorFor('en').t('errors.forbidden')).toEqual({ ok: true, value: 'Not allowed.' });
  });

  it('fails with the key when no catalogue on the chain has it, rather than throwing', () => {
    const { t } = createTranslator<{ videos: { gone: typeof catalogues.source.errors.forbidden } }>(
      {
        intl: intlFor('sv-FI'),
        catalogues,
        kinds,
        presets,
      }
    );

    expect(t('videos.gone')).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'FORMAT_UNRENDERABLE', key: 'videos.gone' }),
    });
  });

  it.each([
    { scenario: 'renders', count: 3, expected: '3 views' },
    { scenario: 'falls back on a failure', count: Number.NaN, expected: 'fallback' },
  ])('tOr $scenario', ({ count, expected }) => {
    expect(translatorFor('en').tOr('videos.views', { count }, 'fallback')).toBe(expected);
  });

  it('keeps working on a locale tag it cannot parse, from the source catalogue', () => {
    expect(translatorFor('not a locale').t('errors.forbidden')).toEqual({
      ok: true,
      value: 'Not allowed.',
    });
  });
});
