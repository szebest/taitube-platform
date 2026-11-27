import { wordsOf } from '../metadata-text';
import { FALLBACK_PROFANITY_LANGUAGE, PROFANITY_WORDS } from '../profanity-words';

describe('@vp/domain-rules: PROFANITY_WORDS', () => {
  it('has a list for the fallback language', () => {
    expect(PROFANITY_WORDS[FALLBACK_PROFANITY_LANGUAGE]?.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(PROFANITY_WORDS))(
    'keeps %s as single lower-case words, each once, so the whole-word match can find them',
    (_language, words) => {
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) expect(wordsOf(word)).toEqual([word]);
    }
  );
});
