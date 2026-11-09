import type { UserContext } from '../../types/index';
import { channelsWith, ownersWith } from '../memberships';

const userWith = (memberships: UserContext['memberships']): UserContext => ({
  id: 'member-1',
  role: 'USER',
  memberships,
});

describe('rules/memberships: the channels a member may act on', () => {
  const member = userWith({
    'chan-a': { role: 'editor', ownerId: 'owner-a' },
    'chan-b': { role: 'moderator', ownerId: 'owner-b' },
  });

  it.each([
    { capability: 'video.edit', owners: { $in: ['owner-a'] }, channels: { $in: ['chan-a'] } },
    {
      capability: 'video.read',
      owners: { $in: ['owner-a', 'owner-b'] },
      channels: { $in: ['chan-a', 'chan-b'] },
    },
    { capability: 'team.manage', owners: null, channels: null },
  ] as const)(
    '$capability: owners $owners, channels $channels',
    ({ capability, owners, channels }) => {
      expect([ownersWith(member, capability), channelsWith(member, capability)]).toEqual([
        owners,
        channels,
      ]);
    }
  );

  it('answers null, never an empty $in, for a user who belongs to no channel', () => {
    expect([
      ownersWith(userWith(undefined), 'video.read'),
      channelsWith(userWith({}), 'video.read'),
    ]).toEqual([null, null]);
  });
});
