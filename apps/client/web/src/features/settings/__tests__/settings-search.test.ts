import { searchSettings } from '../settings-search';

const ENTRIES = [
  { label: 'Corners', keywords: 'rounded round sharp radius' },
  { label: 'Theme', keywords: 'colours palette corners' },
  { label: 'Autoplay next', keywords: 'continue queue' },
];

describe('searchSettings', () => {
  it.each([
    { label: 'by label', query: 'autoplay', found: ['Autoplay next'] },
    { label: 'by keyword, any case', query: 'ROUNDED', found: ['Corners'] },
    { label: 'by every word', query: 'colours corners', found: ['Theme'] },
    { label: 'label matches first', query: 'corners', found: ['Corners', 'Theme'] },
    { label: 'nothing for no words', query: '  ', found: [] },
    { label: 'nothing for no match', query: 'zebra', found: [] },
  ])('finds $found $label', ({ query, found }) => {
    expect(searchSettings(ENTRIES, query).map((entry) => entry.label)).toEqual(found);
  });
});
