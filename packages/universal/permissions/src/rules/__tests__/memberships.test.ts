import type { UserContext } from '../../types/index';
import { channelsWith } from '../memberships';

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
    { capability: 'video.edit', channels: { $in: ['chan-a'] } },
    { capability: 'video.read', channels: { $in: ['chan-a', 'chan-b'] } },
    { capability: 'team.manage', channels: null },
  ] as const)('$capability: channels $channels', ({ capability, channels }) => {
    expect(channelsWith(member, capability)).toEqual(channels);
  });

  it('answers null, never an empty $in, for a user who belongs to no channel', () => {
    expect([
      channelsWith(userWith(undefined), 'video.read'),
      channelsWith(userWith({}), 'video.read'),
    ]).toEqual([null, null]);
  });
});
