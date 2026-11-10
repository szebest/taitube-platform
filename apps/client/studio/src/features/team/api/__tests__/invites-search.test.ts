import { InvitesSearchSchema } from '../invites-search';

const INVITE = '0190c3a0-5e1d-7000-8000-0000000dd002';

describe('apps/client/studio: InvitesSearchSchema', () => {
  it.each([
    { search: {}, expected: { invite: undefined } },
    { search: { invite: INVITE }, expected: { invite: INVITE } },
    { search: { invite: 'nope' }, expected: { invite: undefined } },
  ])('reads $search as $expected', ({ search, expected }) => {
    expect(InvitesSearchSchema.parse(search)).toEqual(expected);
  });
});
