import { createRegistry } from '@kit/di';
import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import { err, ok } from '@kit/result';
import { type CatalogueSet, type CatalogueShape, findMessage } from '../catalogue';
import type { I18n } from '../engine';
import { Catalogues } from '../tokens';
import type { Translator } from '../translator';

export interface I18nSubject {
  readonly i18n: I18n<CatalogueShape>;
  readonly catalogues: CatalogueSet<CatalogueShape>;
}

export type MakeI18nSubject = () => I18nSubject;

const NOW = '2026-09-22T18:30:00.000Z';
const PROBE = 'contract.probe';

const intlFor = (locale: string): IntlBinding =>
  createIntl({ locale, timeZone: 'UTC', now: NOW, cache: createIntlCache() });

const render = (translator: Translator<CatalogueShape>, key: string): unknown =>
  Reflect.apply(translator.t, translator, [key]);

const probeCatalogue = (template: string): CatalogueShape => ({
  contract: { probe: { template, config: {} } },
});

export function describeI18nContract(makeSubject: MakeI18nSubject): void {
  describe('I18n contract', () => {
    let subject: I18nSubject;

    beforeEach(() => {
      subject = makeSubject();
    });

    it('holds no message in a translation that the source locale lacks', () => {
      const { source, translations } = subject.catalogues;
      const orphans = Object.entries(translations).flatMap(([locale, translation]) =>
        Object.entries(translation).flatMap(([namespace, messages]) =>
          Object.keys(messages ?? {})
            .filter((name) => findMessage(source, `${namespace}.${name}`) === undefined)
            .map((name) => `${locale}: ${namespace}.${name}`)
        )
      );

      expect(orphans).toEqual([]);
    });

    it('fails a key no catalogue holds with the missing key, never a throw', () => {
      const translator = subject.i18n.createTranslator(
        intlFor(subject.catalogues.locale),
        subject.catalogues
      );

      expect(render(translator, PROBE)).toMatchObject({ ok: false, error: { key: PROBE } });
    });

    it('builds its translator from what the app provided, and has no default catalogue', () => {
      const { i18n, catalogues } = subject;
      const intl = intlFor(catalogues.locale);
      const registry = createRegistry().provide(...i18n.providers(catalogues));

      expect(i18n.fromRegistry(registry, intl).ok).toBe(true);
      expect(i18n.fromRegistry(createRegistry(), intl)).toEqual(
        err({ code: 'MISSING_PROVIDER', token: Catalogues.name })
      );
    });

    it('renders a swapped catalogue in place of the app one, a locale along its chain first', () => {
      const { i18n, catalogues } = subject;
      const other = catalogues.locale === 'sv' ? 'en' : 'sv';
      const swapped = {
        locale: catalogues.locale,
        source: probeCatalogue('source'),
        translations: { [other]: probeCatalogue('translated') },
      };
      const registry = createRegistry().provide(...i18n.providers(swapped));
      const renderIn = (locale: string) => {
        const translator = i18n.fromRegistry(registry, intlFor(locale));
        return translator.ok ? render(translator.value, PROBE) : translator;
      };

      expect([renderIn(catalogues.locale), renderIn(other)]).toEqual([
        ok('source'),
        ok('translated'),
      ]);
    });
  });
}
