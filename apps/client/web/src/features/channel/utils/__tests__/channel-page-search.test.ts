import { ChannelPageSearchSchema } from '../channel-page-search';

describe('apps/client/web: channel page search', () => {
  it.each([
    {
      search: { preview: 'draft', as: 'subscriber' },
      parsed: { preview: 'draft', as: 'subscriber' },
    },
    { search: { preview: 'draft' }, parsed: { preview: 'draft', as: undefined } },
    { search: { preview: 'live', as: 'admin' }, parsed: { preview: undefined, as: undefined } },
    { search: {}, parsed: { preview: undefined, as: undefined } },
  ])('reads $search as $parsed', ({ search, parsed }) => {
    expect(ChannelPageSearchSchema.parse(search)).toEqual(parsed);
  });
});
