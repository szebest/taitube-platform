import type { LocaleDetails, Locales } from '../locales';

/** @public */
export type MakeLocales = () => Locales<string, LocaleDetails>;

const UNREGISTERED = 'contract-ZZ';
const INHERITED_KEYS = ['toString', 'constructor', '__proto__', 'hasOwnProperty'];

/** @public */
export function describeLocalesContract(makeLocales: MakeLocales): void {
  describe('Locales contract', () => {
    let locales: Locales<string, LocaleDetails>;

    beforeEach(() => {
      locales = makeLocales();
    });

    it('lists exactly the tags it holds details for, its source among them', () => {
      expect(locales.tags.toSorted()).toEqual(Object.keys(locales.details).toSorted());
      expect(locales.tags).toContain(locales.source);
    });

    it('names every tag in itself and gives it a direction', () => {
      const incomplete = Object.entries(locales.details).filter(
        ([, { name, direction }]) =>
          name.length === 0 || (direction !== 'ltr' && direction !== 'rtl')
      );

      expect(incomplete).toEqual([]);
    });

    it('supports each tag it lists, and no other', () => {
      expect(locales.tags.filter((tag) => !locales.isSupported(tag))).toEqual([]);
      expect(locales.isSupported(UNREGISTERED)).toBe(false);
    });

    it('does not take a key every object inherits for a tag', () => {
      expect(INHERITED_KEYS.filter((key) => locales.isSupported(key))).toEqual([]);
    });

    it('is frozen, so no caller adds a locale after the app registered its own', () => {
      expect(Object.isFrozen(locales)).toBe(true);
    });
  });
}
