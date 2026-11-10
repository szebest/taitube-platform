import type { ScreeningMetadata } from '../metadata-text';
import { screenMetadataInLocales } from '../screen-metadata.rule';
import { THRESHOLDS } from './thresholds';

const clean: ScreeningMetadata = {
  title: 'A calm walk through the forest',
  description: 'Recorded on a quiet morning near the lake.',
  tags: ['walk'],
  locale: 'en',
  recentTitles: [],
};

const screenInLocale = (metadata: ScreeningMetadata) => {
  const { locale, ...text } = metadata;
  return screenMetadataInLocales(text, [locale], THRESHOLDS);
};

describe('@vp/domain-rules: screenMetadataInLocales, one language', () => {
  it('finds nothing in a clean text', () => {
    expect(screenInLocale(clean)).toBeNull();
  });

  it.each([
    { name: 'profanity alone', overrides: { title: 'This shit is great' }, score: 0.4 },
    {
      name: 'a repeated title alone',
      overrides: { recentTitles: ['A calm walk through the forest'] },
      score: 0.4,
    },
    {
      name: 'profanity and a repeated title',
      overrides: { title: 'Shit', recentTitles: ['shit'] },
      score: 0.8,
    },
    {
      name: 'every signal, capped at one',
      overrides: {
        title: 'BUY BUY BUY BUY BUY SHIT',
        description: 'www.a.example www.b.example www.c.example www.d.example',
        tags: Array.from({ length: 31 }, () => 'buy'),
        recentTitles: ['buy buy buy buy buy shit'],
      },
      score: 1,
    },
  ])('scores $name as $score', ({ overrides, score }) => {
    const finding = screenInLocale({ ...clean, ...overrides });

    expect(finding).toMatchObject({ reason: 'METADATA_SPAM', score });
  });

  it('keeps the signals and the measures as evidence', () => {
    const finding = screenInLocale({ ...clean, title: 'Shit', recentTitles: ['shit'] });

    expect(finding?.evidence).toMatchObject({
      signals: ['sameTitle'],
      profanity: ['shit'],
      sameTitle: true,
    });
  });
});

describe('@vp/domain-rules: screenMetadataInLocales, several languages', () => {
  const { locale: _locale, ...text } = clean;

  it.each([
    { name: 'a clean text', title: clean.title, locales: ['en', 'pl'], expected: null },
    {
      name: 'English profanity read in English',
      title: 'This is shit',
      locales: ['en'],
      expected: 'METADATA_SPAM',
    },
    {
      name: 'Polish profanity under both languages',
      title: 'To jest kurwa dobre',
      locales: ['en', 'pl'],
      expected: 'METADATA_SPAM',
    },
    {
      name: 'Polish profanity read in English only',
      title: 'To jest kurwa dobre',
      locales: ['en'],
      expected: null,
    },
    { name: 'no language at all', title: 'This is shit', locales: [], expected: null },
  ])('finds $name: $expected', ({ title, locales, expected }) => {
    const finding = screenMetadataInLocales({ ...text, title }, locales, THRESHOLDS);

    expect(finding?.reason ?? null).toBe(expected);
  });

  it('keeps the strongest hit of the languages', () => {
    const finding = screenMetadataInLocales(
      { ...text, title: 'shit kurwa', recentTitles: ['shit kurwa'] },
      ['en', 'pl'],
      THRESHOLDS
    );

    expect(finding?.score).toBe(0.8);
  });
});
