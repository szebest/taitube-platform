import { TeamSearchSchema } from '../team-search';

const ACTOR = '0190c3a0-5e1d-7000-8000-0000000bb003';

describe('apps/client/studio: TeamSearchSchema', () => {
  it.each([
    { search: {}, expected: { tab: 'members', actor: undefined, action: undefined } },
    { search: { tab: 'audit' }, expected: { tab: 'audit', actor: undefined, action: undefined } },
    { search: { tab: 'nope' }, expected: { tab: 'members', actor: undefined, action: undefined } },
    {
      search: { tab: 'audit', actor: ACTOR, action: 'member.removed' },
      expected: { tab: 'audit', actor: ACTOR, action: 'member.removed' },
    },
    {
      search: { actor: 'someone', action: 'delete.everything' },
      expected: { tab: 'members', actor: undefined, action: undefined },
    },
  ])('reads $search as $expected', ({ search, expected }) => {
    expect(TeamSearchSchema.parse(search)).toEqual(expected);
  });
});
