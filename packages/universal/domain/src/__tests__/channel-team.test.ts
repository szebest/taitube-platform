import {
  type ActingRole,
  CHANNEL_ROLE_NAMES,
  type ChannelCapability,
  roleHas,
} from '../channel-team';

describe('@vp/domain: channel team', () => {
  it.each(CHANNEL_ROLE_NAMES)('lets a %s read the channel videos but never own it', (role) => {
    expect([roleHas(role, 'video.read'), roleHas(role, 'channel.own')]).toEqual([true, false]);
  });

  it.each<[ActingRole, ChannelCapability, boolean]>([
    ['owner', 'channel.own', true],
    ['manager', 'team.manage', true],
    ['editor', 'video.edit', true],
    ['editor', 'video.delete', false],
    ['moderator', 'comment.moderate', true],
    ['moderator', 'video.edit', false],
    ['analytics', 'analytics.read', true],
    ['analytics', 'comment.pin', false],
  ])('a %s holding %s: %s', (role, capability, expected) => {
    expect(roleHas(role, capability)).toBe(expected);
  });
});
