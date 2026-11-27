import { bodyOf, languageOf, normalizedTitle, wordsOf } from '../metadata-text';

describe('@vp/domain-rules: metadata text', () => {
  it.each([
    { text: 'Hello, World! 42', words: ['hello', 'world', '42'] },
    { text: 'Zażółć  gęślą-jaźń', words: ['zażółć', 'gęślą', 'jaźń'] },
    { text: '  ...  ', words: [] },
  ])('splits "$text" into words', ({ text, words }) => {
    expect(wordsOf(text)).toEqual(words);
  });

  it('compares titles by their words only', () => {
    expect(normalizedTitle('  My   VIDEO!! ')).toBe('my video');
  });

  it.each([
    { locale: 'pl-PL', language: 'pl' },
    { locale: 'EN', language: 'en' },
    { locale: '', language: '' },
  ])('reads the language of $locale', ({ locale, language }) => {
    expect(languageOf(locale)).toBe(language);
  });

  it.each([
    { description: 'More', body: 'Title\nMore' },
    { description: null, body: 'Title' },
  ])('joins the title and a description of $description', ({ description, body }) => {
    expect(bodyOf({ title: 'Title', description, tags: [], locale: 'en', recentTitles: [] })).toBe(
      body
    );
  });
});
