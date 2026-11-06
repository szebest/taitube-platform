import { InboxSearchSchema } from '../inbox-search';

describe('apps/client/studio: InboxSearchSchema', () => {
  it.each([
    { search: {}, filter: 'all' },
    { search: { filter: 'unanswered' }, filter: 'unanswered' },
    { search: { filter: 'reported' }, filter: 'reported' },
    { search: { filter: 'spam' }, filter: 'all' },
  ])('reads $search as the $filter filter', ({ search, filter }) => {
    expect(InboxSearchSchema.parse(search)).toEqual({ filter });
  });
});
