import {
  type ActingRole,
  CHANNEL_AUDIT_ACTIONS,
  CHANNEL_CAPABILITIES,
  VIDEO_AUDIT_FIELDS,
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

  it('lists every capability, so the owner holds all of them and a manager all but ownership', () => {
    expect(CHANNEL_CAPABILITIES.filter((capability) => roleHas('owner', capability))).toEqual(
      CHANNEL_CAPABILITIES
    );
    expect(CHANNEL_CAPABILITIES.filter((capability) => !roleHas('manager', capability))).toEqual([
      'channel.own',
    ]);
  });

  it('names the video fields an audit row can carry', () => {
    expect(VIDEO_AUDIT_FIELDS).toEqual([
      'title',
      'description',
      'visibility',
      'categoryId',
      'tags',
      'thumbnail',
    ]);
  });

  it.each([
    'video.comments.toggled',
    'comment.held',
    'comment.approved',
    'comment.hidden',
    'comment.unhidden',
    'comment.removed',
    'comment.pinned',
    'user.shadow_banned',
    'user.banned',
    'user.restriction_lifted',
    'trusted.added',
    'trusted.removed',
    'settings.comments.updated',
  ] as const)('audits %s', (action) => {
    expect(CHANNEL_AUDIT_ACTIONS).toContain(action);
  });
});
