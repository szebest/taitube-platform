import { getMemberSubject } from '../get-member-subject';

const ROLES = [
  { id: 'r-dj', position: 20 },
  { id: 'r-mod', position: 60 },
];

describe('apps/client/web: getMemberSubject', () => {
  it.each([
    { scenario: 'the highest role they hold', roleIds: ['r-dj', 'r-mod'], top: 60 },
    { scenario: 'the only role they hold', roleIds: ['r-dj'], top: 20 },
    { scenario: 'zero with no role', roleIds: [], top: 0 },
    { scenario: 'a role the room no longer lists', roleIds: ['r-gone'], top: 0 },
  ])('puts a member at $scenario', ({ roleIds, top }) => {
    const subject = getMemberSubject(
      { kind: 'user', memberKey: 'user:1', roleIds },
      ROLES,
      'user:9'
    );

    expect(subject).toEqual({ topPosition: top, isOwner: false, kind: 'user' });
  });

  it('marks the owner by their member key', () => {
    const subject = getMemberSubject(
      { kind: 'user', memberKey: 'user:9', roleIds: [] },
      ROLES,
      'user:9'
    );

    expect(subject.isOwner).toBe(true);
  });
});
