import { listMore } from '../list-more';

describe('@vp/shared-messages: listMore', () => {
  it.each(Object.entries(listMore))(
    'names a branch for every plural category of %s that counts hidden items',
    (locale, branches) => {
      const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

      expect(
        categories.filter((category) => !(category in branches) && category !== 'other')
      ).toEqual([]);
    }
  );
});
