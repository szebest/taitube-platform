import { Catalogues, ParamVocabulary } from '@kit/i18n';
import { FormatPresets } from '@kit/intl';
import { WEB_SOURCE } from '#app/lib/messages';
import { webComposition } from '../registry';

describe('web composition', () => {
  it('provides the app catalogues, format presets and param vocabulary', () => {
    const { registry } = webComposition;

    expect(registry.get(Catalogues)).toMatchObject({ ok: true, value: { source: WEB_SOURCE } });
    expect(registry.get(FormatPresets).ok).toBe(true);
    expect(registry.get(ParamVocabulary).ok).toBe(true);
  });

  it('hands the platform providers the app values', () => {
    expect(webComposition.session).toMatchObject({
      apiBaseUrl: webComposition.apiBaseUrl,
      cookieDomain: webComposition.cookieDomain,
    });
    expect(webComposition.telemetry).toMatchObject({ apiBaseUrl: webComposition.apiBaseUrl });
    expect(webComposition.messages.source).toBe(WEB_SOURCE);
  });
});
