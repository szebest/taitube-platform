import { resolveLocale } from '../resolve-locale';

describe('@vp/intl-react: resolveLocale', () => {
  it.each([
    {
      scenario: 'the explicit prop',
      candidates: { explicit: 'de', persisted: 'sv', languages: ['fr'] },
      expected: 'de',
    },
    {
      scenario: 'the saved preference',
      candidates: { persisted: 'sv', languages: ['fr'] },
      expected: 'sv',
    },
    {
      scenario: "the browser's first language",
      candidates: { languages: ['fr-CA', 'en'] },
      expected: 'fr-CA',
    },
    { scenario: 'the fallback', candidates: { languages: [] }, expected: 'en' },
  ])('takes $scenario when nothing before it is set', ({ candidates, expected }) => {
    expect(resolveLocale(candidates)).toBe(expected);
  });

  it.each([
    { scenario: 'an empty prop', candidates: { explicit: '', languages: ['sv'] }, expected: 'sv' },
    {
      scenario: 'a malformed saved value',
      candidates: { persisted: 'not a locale', languages: ['de'] },
      expected: 'de',
    },
  ])('skips $scenario', ({ candidates, expected }) => {
    expect(resolveLocale(candidates)).toBe(expected);
  });
});
