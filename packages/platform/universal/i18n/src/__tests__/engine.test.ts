import { createRegistry } from '@kit/di';
import { err, ok } from '@vp/result';
import { defineEngine } from '../engine';
import { defineKind } from '../kind';
import { defineParams } from '../params';
import { definePresets } from '../presets';
import {
  catalogues,
  engine,
  i18n,
  intlFor,
  params,
  presets,
  type source,
  swedish,
} from './fixtures';

const { dt } = engine;

describe('@kit/i18n: defineEngine', () => {
  it.each([
    { scenario: 'a template alone', message: dt('Hello {name}'), config: {} },
    {
      scenario: 'a template with its config',
      message: dt('{price:number}', { number: { price: 'whole' } }),
      config: { number: { price: 'whole' } },
    },
  ])('keeps $scenario as frozen data', ({ message, config }) => {
    expect(message.config).toEqual(config);
    expect(Object.isFrozen(message)).toBe(true);
  });

  it('returns a translation from defineCatalogue as written', () => {
    expect(engine.defineCatalogue<typeof source>()(swedish)).toBe(swedish);
  });

  it('renders through createTranslator with the engine kinds and presets', () => {
    const { t } = i18n.createTranslator(intlFor('en'), catalogues);

    expect(t('videos.views', { count: 12_345 })).toEqual({ ok: true, value: '12K views' });
  });

  it('provides Catalogues, FormatPresets and ParamVocabulary, and translates from that registry', () => {
    const registry = createRegistry().provide(...i18n.providers(catalogues));
    const translator = i18n.fromRegistry(registry, intlFor('sv'));

    expect(translator.ok && translator.value.t('videos.views', { count: 2 })).toEqual({
      ok: true,
      value: '2 visningar',
    });
    expect(i18n.providers(catalogues).map(({ value }) => value)).toEqual([
      catalogues,
      presets,
      params,
    ]);
  });

  it('fails with MissingProvider from a registry the app did not fill', () => {
    expect(i18n.fromRegistry(createRegistry(), intlFor('en'))).toEqual(
      err(expect.objectContaining({ code: 'MISSING_PROVIDER', token: 'Catalogues' }))
    );
  });

  it('renders a kind and a preset an app registers, with no edit to the engine', () => {
    const initials = defineKind({
      name: 'initials',
      config: 'optional',
      arg: (value): value is string => typeof value === 'string',
      options: (value): value is { readonly separator: string } =>
        typeof value === 'object' && value !== null,
      render: (value, options) =>
        ok(
          value
            .split(' ')
            .map((word) => word.charAt(0))
            .join(options?.separator ?? '')
        ),
    });
    const second = defineEngine({
      kinds: [initials],
      presets: definePresets({ initials: { dotted: { default: { separator: '.' } } } }),
      params: defineParams(['author'] as const),
    });
    const byline = {
      book: { byline: second.dt('by {author:initials}', { initials: { author: 'dotted' } }) },
    };
    const { t } = second
      .createI18n<typeof byline>()
      .createTranslator(intlFor('en'), { locale: 'en', source: byline, translations: {} });

    expect(t('book.byline', { author: 'Ada Lovelace' })).toEqual(ok('by A.L'));
  });
});
