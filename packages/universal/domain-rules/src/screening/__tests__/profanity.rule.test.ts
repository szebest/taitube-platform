import type { ScreeningMetadata } from '../metadata-text';
import { findProfanity } from '../profanity.rule';

const metadata = (overrides: Partial<ScreeningMetadata>): ScreeningMetadata => ({
  title: 'A clip',
  description: null,
  tags: [],
  locale: 'en',
  recentTitles: [],
  ...overrides,
});

describe('@vp/domain-rules: findProfanity', () => {
  it.each([
    { name: 'a clean text', overrides: {}, found: [] },
    { name: 'the title', overrides: { title: 'What the FUCK' }, found: ['fuck'] },
    { name: 'the description', overrides: { description: 'total bullshit' }, found: ['bullshit'] },
    { name: 'a tag', overrides: { tags: ['asshole'] }, found: ['asshole'] },
    {
      name: 'a repeated word, once',
      overrides: { title: 'shit shit', description: 'shit' },
      found: ['shit'],
    },
    { name: 'a word inside another word', overrides: { title: 'Scunthorpe assume' }, found: [] },
    {
      name: 'the list of its own language',
      overrides: { locale: 'pl-PL', title: 'ale kurwa' },
      found: ['kurwa'],
    },
    { name: 'a Polish word read as English', overrides: { title: 'ale kurwa' }, found: [] },
    {
      name: 'an unlisted language, read as English',
      overrides: { locale: 'xx', title: 'shit' },
      found: ['shit'],
    },
  ])('finds $found in $name', ({ overrides, found }) => {
    expect(findProfanity(metadata(overrides))).toEqual(found);
  });
});
