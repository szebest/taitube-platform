import type { ScreeningMetadata } from '../metadata-text';
import { type SpamMeasures, measureSpam, spamSignals } from '../spam.rule';
import { THRESHOLDS } from './thresholds';

const metadata = (overrides: Partial<ScreeningMetadata>): ScreeningMetadata => ({
  title: 'A calm walk through the forest',
  description: 'Recorded on a quiet morning near the lake.',
  tags: [],
  locale: 'en',
  recentTitles: [],
  ...overrides,
});

const measures = (overrides: Partial<SpamMeasures>): SpamMeasures => ({
  links: 0,
  tags: 0,
  repeatShare: 0,
  capsShare: 0,
  sameTitle: false,
  ...overrides,
});

describe('@vp/domain-rules: measureSpam', () => {
  it('measures a plain text as below every limit', () => {
    const plain = measureSpam(metadata({}));

    expect(spamSignals(plain, THRESHOLDS)).toEqual([]);
    expect(plain).toMatchObject({ links: 0, tags: 0, sameTitle: false });
  });

  it.each([
    {
      name: 'http, https and www links in the title and description',
      overrides: {
        title: 'see https://a.example',
        description: 'http://b.example and www.c.example',
      },
      expected: { links: 3 },
    },
    {
      name: 'every tag',
      overrides: { tags: ['a', 'b', 'c'] },
      expected: { tags: 3 },
    },
    {
      name: 'a term repeated across the text',
      overrides: {
        title: 'buy buy buy buy',
        description: 'buy now buy cheap buy',
        tags: ['buy'],
      },
      expected: { repeatShare: 0.8 },
    },
    {
      name: 'too few words to judge repeats',
      overrides: { title: 'buy buy buy', description: null },
      expected: { repeatShare: 0 },
    },
    {
      name: 'a shouted text',
      overrides: { title: 'WATCH THIS NOW', description: 'AMAZING' },
      expected: { capsShare: 1 },
    },
    {
      name: 'too few letters to judge caps',
      overrides: { title: 'WOW', description: null },
      expected: { capsShare: 0 },
    },
    {
      name: 'a title the creator used before, in other case and punctuation',
      overrides: { title: 'My Vlog!', recentTitles: ['other', 'my vlog'] },
      expected: { sameTitle: true },
    },
    {
      name: 'an empty title',
      overrides: { title: '', recentTitles: [''] },
      expected: { sameTitle: false },
    },
  ])('measures $name', ({ overrides, expected }) => {
    expect(measureSpam(metadata(overrides))).toMatchObject(expected);
  });
});

describe('@vp/domain-rules: spamSignals', () => {
  it.each([
    { name: 'nothing', given: {}, signals: [] },
    { name: 'links at the limit', given: { links: 3 }, signals: [] },
    { name: 'links past the limit', given: { links: 4 }, signals: ['links'] },
    { name: 'tags at the limit', given: { tags: 30 }, signals: [] },
    { name: 'tags past the limit', given: { tags: 31 }, signals: ['tags'] },
    { name: 'repeats at the limit', given: { repeatShare: 0.5 }, signals: [] },
    { name: 'repeats past the limit', given: { repeatShare: 0.51 }, signals: ['repeats'] },
    { name: 'caps at the limit', given: { capsShare: 0.7 }, signals: [] },
    { name: 'caps past the limit', given: { capsShare: 0.71 }, signals: ['caps'] },
    { name: 'a repeated title', given: { sameTitle: true }, signals: ['sameTitle'] },
    {
      name: 'several at once, in a fixed order',
      given: { sameTitle: true, links: 9, capsShare: 1 },
      signals: ['links', 'caps', 'sameTitle'],
    },
  ])('reports $signals for $name', ({ given, signals }) => {
    expect(spamSignals(measures(given), THRESHOLDS)).toEqual(signals);
  });
});
