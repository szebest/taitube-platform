import { Catalogues, ParamVocabulary } from '@kit/i18n';
import { FormatPresets } from '@kit/intl';
import { STUDIO_SOURCE } from '#app/lib/messages';
import { studioComposition } from '../registry';

describe('studio composition', () => {
  it('provides the app catalogues, format presets and param vocabulary', () => {
    const { registry } = studioComposition;

    expect(registry.get(Catalogues)).toMatchObject({ ok: true, value: { source: STUDIO_SOURCE } });
    expect(registry.get(FormatPresets).ok).toBe(true);
    expect(registry.get(ParamVocabulary).ok).toBe(true);
  });

  it('hands the platform providers the app values', () => {
    expect(studioComposition.session).toMatchObject({
      apiBaseUrl: studioComposition.apiBaseUrl,
      cookieDomain: studioComposition.cookieDomain,
    });
    expect(studioComposition.telemetry).toMatchObject({ apiBaseUrl: studioComposition.apiBaseUrl });
    expect(studioComposition.messages.source).toBe(STUDIO_SOURCE);
  });
});
