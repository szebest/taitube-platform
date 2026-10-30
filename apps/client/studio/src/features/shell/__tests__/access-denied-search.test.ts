import { AccessDeniedSearchSchema } from '../access-denied-search';

describe('apps/client/studio: AccessDeniedSearchSchema', () => {
  it.each([
    { search: { denied: 'admin' }, parsed: { denied: 'admin' } },
    { search: {}, parsed: {} },
    { search: { denied: 'anything-else' }, parsed: undefined },
  ])('reads $search as $parsed', ({ search, parsed }) => {
    expect(AccessDeniedSearchSchema.safeParse(search).data).toEqual(parsed);
  });
});
