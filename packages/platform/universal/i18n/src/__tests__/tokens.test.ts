import { createRegistry, provide } from '@kit/di';
import { err, ok } from '@vp/result';
import { Catalogues, FormatPresets, ParamVocabulary } from '../tokens';
import { catalogues, params, presets } from './fixtures';

describe('@kit/i18n: tokens', () => {
  it('resolves each token to what the app provided', () => {
    const registry = createRegistry().provide(
      provide(Catalogues, catalogues),
      provide(FormatPresets, presets),
      provide(ParamVocabulary, params)
    );

    expect([
      registry.get(Catalogues),
      registry.get(FormatPresets),
      registry.get(ParamVocabulary),
    ]).toEqual([ok(catalogues), ok(presets), ok(params)]);
  });

  it('has no default: an unprovided token is MissingProvider', () => {
    const empty = createRegistry();

    expect([empty.get(Catalogues), empty.get(FormatPresets), empty.get(ParamVocabulary)]).toEqual(
      ['Catalogues', 'FormatPresets', 'ParamVocabulary'].map((token) =>
        err(expect.objectContaining({ code: 'MISSING_PROVIDER', token }))
      )
    );
  });
});
