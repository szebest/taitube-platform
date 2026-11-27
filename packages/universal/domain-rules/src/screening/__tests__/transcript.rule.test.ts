import { screenTranscript } from '../transcript.rule';
import { THRESHOLDS } from './thresholds';

describe('@vp/domain-rules: screenTranscript', () => {
  it.each([
    { name: 'clean speech', text: 'Today we walk through the forest', locale: 'en', words: null },
    { name: 'English profanity', text: 'well this is shit really', locale: 'en', words: ['shit'] },
    { name: 'Polish profanity', text: 'to jest kurwa dobre', locale: 'pl', words: ['kurwa'] },
    {
      name: 'an undetermined language, read by the fallback list',
      text: 'shit',
      locale: 'und',
      words: ['shit'],
    },
    {
      name: 'Polish words read as English',
      text: 'to jest kurwa dobre',
      locale: 'en',
      words: null,
    },
    { name: 'no speech at all', text: '', locale: 'en', words: null },
  ])('finds $name: $words', ({ text, locale, words }) => {
    const finding = screenTranscript(text, locale, THRESHOLDS);

    expect(finding?.evidence.profanity ?? null).toEqual(words);
  });

  it('tags the finding with its source and keeps it as weak as one signal of the text', () => {
    expect(screenTranscript('shit', 'en', THRESHOLDS)).toEqual({
      reason: 'METADATA_SPAM',
      score: THRESHOLDS.spamSignalWeight,
      evidence: { source: 'transcript', signals: ['profanity'], profanity: ['shit'] },
    });
  });
});
