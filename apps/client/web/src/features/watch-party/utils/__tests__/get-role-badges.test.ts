import { getRoleBadges } from '../get-role-badges';

const ROLES = [
  { id: 'r-dj', name: 'DJ', colour: '#3b82c4', position: 20 },
  { id: 'r-mod', name: 'Moderator', colour: '#c9772f', position: 60 },
  { id: 'r-plain', name: 'Member', colour: null, position: 1 },
];

describe('apps/client/web: getRoleBadges', () => {
  it('lists the coloured roles a member holds, highest first', () => {
    const badges = getRoleBadges({ roleIds: ['r-dj', 'r-mod', 'r-plain'] }, ROLES);

    expect(badges).toEqual([
      { id: 'r-mod', name: 'Moderator', colour: '#c9772f' },
      { id: 'r-dj', name: 'DJ', colour: '#3b82c4' },
    ]);
  });

  it.each([
    { scenario: 'an author who is not in the roster', member: undefined },
    { scenario: 'a member with no role', member: { roleIds: [] } },
  ])('has no badge for $scenario', ({ member }) => {
    expect(getRoleBadges(member, ROLES)).toEqual([]);
  });
});
