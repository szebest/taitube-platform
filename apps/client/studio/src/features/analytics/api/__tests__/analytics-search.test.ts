import { AnalyticsSearchSchema } from '../analytics-search';

describe('apps/client/studio: analytics search params', () => {
  it.each([
    { given: 'nothing', search: {}, range: '30d' },
    { given: 'a range from the address bar', search: { range: '7d' }, range: '7d' },
    { given: 'a range the API does not have', search: { range: 'lifetime' }, range: '30d' },
  ])('reads $given', ({ search, range }) => {
    expect(AnalyticsSearchSchema.parse(search)).toEqual({ range });
  });
});
