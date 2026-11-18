import { stopWordsFor } from '../stop-words';

describe('@vp/domain: stopWordsFor', () => {
  it.each([
    { language: 'en', listed: true },
    { language: 'en-GB', listed: true },
    { language: 'EN', listed: true },
    { language: 'pl', listed: false },
    { language: null, listed: false },
  ])('$language has a list: $listed', ({ language, listed }) => {
    expect(stopWordsFor(language) !== null).toBe(listed);
  });

  it('lists the English filler words', () => {
    expect(stopWordsFor('en')?.has('the')).toBe(true);
  });
});
