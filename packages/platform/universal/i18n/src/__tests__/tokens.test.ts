import { createRegistry, provide } from '@kit/di';
import { err, ok } from '@kit/result';
import { Catalogues, ParamVocabulary } from '../tokens';
import { catalogues, params } from './fixtures';

describe('@kit/i18n: tokens', () => {
  it('resolves each token to what the app provided', () => {
    const registry = createRegistry().provide(
      provide(Catalogues, catalogues),
      provide(ParamVocabulary, params)
    );

    expect([registry.get(Catalogues), registry.get(ParamVocabulary)]).toEqual([
      ok(catalogues),
      ok(params),
    ]);
  });

  it('has no default: an unprovided token is MissingProvider', () => {
    const empty = createRegistry();

    expect([empty.get(Catalogues), empty.get(ParamVocabulary)]).toEqual(
      ['Catalogues', 'ParamVocabulary'].map((token) =>
        err(expect.objectContaining({ code: 'MISSING_PROVIDER', token }))
      )
    );
  });
});
