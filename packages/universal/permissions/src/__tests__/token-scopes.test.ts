import { subject } from '@casl/ability';
import { API_SCOPES } from '@vp/domain';
import { getUserPermissions } from '../ability';
import type { AppAction, AppSubjects, UserContext } from '../types/index';
import {
  analytics,
  analyticsMember,
  as,
  channelExport,
  comment,
  foreign,
  manager,
  onTeam,
  OTHER_OWNER,
  OWN_CHANNEL,
  OWNER_ID,
  publicVideo,
  SECOND_CHANNEL,
  TEAM_CHANNEL,
  TEAM_OWNER,
  tokenOf,
  video,
} from './token-fixtures';

describe('permissions: a token is its user cut down to its scopes', () => {
  it.each<{
    scenario: string;
    user: UserContext;
    action: AppAction;
    target: AppSubjects;
    allowed: boolean;
  }>([
    {
      scenario: 'analytics:read reads the own analytics',
      user: tokenOf(['analytics:read']),
      action: 'read',
      target: analytics(OWNER_ID),
      allowed: true,
    },
    {
      scenario: 'analytics:read deletes no comment',
      user: tokenOf(['analytics:read']),
      action: 'delete',
      target: comment(OWNER_ID),
      allowed: false,
    },
    {
      scenario: 'analytics:read edits no video',
      user: tokenOf(['analytics:read']),
      action: 'update',
      target: video(OWNER_ID),
      allowed: false,
    },
    {
      scenario: 'videos:write edits the own video',
      user: tokenOf(['videos:write']),
      action: 'update',
      target: video(OWNER_ID),
      allowed: true,
    },
    {
      scenario: "videos:write edits no other creator's video",
      user: tokenOf(['videos:write']),
      action: 'update',
      target: video(OTHER_OWNER),
      allowed: false,
    },
    {
      scenario: 'videos:write deletes no video',
      user: tokenOf(['videos:write']),
      action: 'delete',
      target: video(OWNER_ID),
      allowed: false,
    },
    {
      scenario: 'videos:read edits no video',
      user: tokenOf(['videos:read']),
      action: 'update',
      target: video(OWNER_ID),
      allowed: false,
    },
    {
      scenario: 'comments:moderate deletes a comment on the own video',
      user: tokenOf(['comments:moderate']),
      action: 'delete',
      target: comment(OWNER_ID),
      allowed: true,
    },
    {
      scenario: 'comments:moderate hides a comment on the own video',
      user: tokenOf(['comments:moderate']),
      action: 'hide',
      target: comment(OWNER_ID),
      allowed: true,
    },
    {
      scenario: 'webhooks:manage registers a webhook',
      user: tokenOf(['webhooks:manage']),
      action: 'create',
      target: 'Webhook',
      allowed: true,
    },
    {
      scenario: 'no webhooks:manage registers no webhook',
      user: tokenOf(['videos:read', 'analytics:read']),
      action: 'create',
      target: 'Webhook',
      allowed: false,
    },
    {
      scenario: "a manager's token edits a video of its team channel",
      user: tokenOf(['videos:write'], manager, TEAM_CHANNEL),
      action: 'update',
      target: video(TEAM_OWNER),
      allowed: true,
    },
    {
      scenario: "a manager's token edits nothing on another team it is on",
      user: tokenOf(['videos:write'], manager, TEAM_CHANNEL),
      action: 'update',
      target: video(OTHER_OWNER),
      allowed: false,
    },
    {
      scenario: "an analytics member's videos:write token edits no team video",
      user: tokenOf(['videos:write'], analyticsMember, TEAM_CHANNEL),
      action: 'update',
      target: video(TEAM_OWNER),
      allowed: false,
    },
    {
      scenario: "an analytics member's token reads the team analytics",
      user: tokenOf(['analytics:read'], analyticsMember, TEAM_CHANNEL),
      action: 'read',
      target: analytics(TEAM_OWNER),
      allowed: true,
    },
    {
      scenario: "a removed member's token reads no team analytics",
      user: tokenOf(['analytics:read'], { memberships: {} }, TEAM_CHANNEL),
      action: 'read',
      target: analytics(TEAM_OWNER),
      allowed: false,
    },
    {
      scenario: "an analytics member's exports:create token exports the team analytics",
      user: tokenOf(['exports:create'], analyticsMember, TEAM_CHANNEL),
      action: 'create',
      target: channelExport(TEAM_CHANNEL, TEAM_OWNER, 'channel_analytics'),
      allowed: true,
    },
    {
      scenario: "an analytics member's exports:create token exports no team comments",
      user: tokenOf(['exports:create'], analyticsMember, TEAM_CHANNEL),
      action: 'create',
      target: channelExport(TEAM_CHANNEL, TEAM_OWNER, 'comments'),
      allowed: false,
    },
    {
      scenario: 'exports:read requests no export',
      user: tokenOf(['exports:read']),
      action: 'create',
      target: channelExport(OWN_CHANNEL, OWNER_ID, 'videos'),
      allowed: false,
    },
    {
      scenario: "an admin's videos:read token manages nothing",
      user: tokenOf(['videos:read'], { role: 'ADMIN' }),
      action: 'manage',
      target: 'all',
      allowed: false,
    },
    {
      scenario: "an admin's videos:read token moderates no comment",
      user: tokenOf(['videos:read'], { role: 'ADMIN' }),
      action: 'moderate',
      target: comment(OTHER_OWNER),
      allowed: false,
    },
  ])('$scenario: $allowed', ({ user, action, target, allowed }) => {
    expect(getUserPermissions(user).can(action, target)).toBe(allowed);
  });

  it.each<[string, UserContext, AppAction, AppSubjects, boolean]>([
    ['admin reads no private video elsewhere', as('ADMIN', 'videos:read'), 'read', foreign, false],
    ['admin reads a public video', as('ADMIN', 'videos:read'), 'read', publicVideo, true],
    ['admin edits no video elsewhere', as('ADMIN', 'videos:write'), 'update', foreign, false],
    [
      'admin edits a video of the channel',
      as('ADMIN', 'videos:write'),
      'update',
      video(OWNER_ID),
      true,
    ],
    [
      'moderator deletes no comment elsewhere',
      as('MODERATOR', 'comments:moderate'),
      'delete',
      comment(OTHER_OWNER),
      false,
    ],
    [
      'moderator deletes a comment on the channel',
      as('MODERATOR', 'comments:moderate'),
      'delete',
      comment(OWNER_ID),
      true,
    ],
    [
      'moderator reads no private video elsewhere',
      as('MODERATOR', 'videos:read'),
      'read',
      foreign,
      false,
    ],
    ['team token edits no own video', onTeam('videos:write'), 'update', video(OWNER_ID), false],
    [
      'team token reads no own private video',
      onTeam('videos:read'),
      'read',
      video(OWNER_ID),
      false,
    ],
    [
      'team token moderates no own comment',
      onTeam('comments:moderate'),
      'moderate',
      comment(OWNER_ID),
      false,
    ],
    [
      'team token reads no own analytics',
      onTeam('analytics:read'),
      'read',
      analytics(OWNER_ID),
      false,
    ],
    [
      'team token exports no own channel',
      onTeam('exports:create'),
      'create',
      channelExport(OWN_CHANNEL, OWNER_ID, 'videos'),
      false,
    ],
    [
      "owner token edits no video of the owner's other channel",
      as('CREATOR', 'videos:write'),
      'update',
      video(OWNER_ID, 'READY', SECOND_CHANNEL),
      false,
    ],
    [
      "owner token reads no analytics of the owner's other channel",
      as('CREATOR', 'analytics:read'),
      'read',
      analytics(OWNER_ID, SECOND_CHANNEL),
      false,
    ],
    [
      'team token moderates the team comment',
      onTeam('comments:moderate'),
      'moderate',
      comment(TEAM_OWNER),
      true,
    ],
  ])('a token stays on its channel: %s', (_scenario, user, action, target, allowed) => {
    expect(getUserPermissions(user).can(action, target)).toBe(allowed);
  });

  it("keeps the user's own refusals: a rejected video's visibility stays locked", () => {
    const ability = getUserPermissions(tokenOf(['videos:write']));

    expect(ability.can('update', video(OWNER_ID, 'REJECTED'), 'title')).toBe(true);
    expect(ability.can('update', video(OWNER_ID, 'REJECTED'), 'visibility')).toBe(false);
  });

  it.each<{ what: string; action: AppAction; target: AppSubjects }>([
    { what: 'create a token', action: 'create', target: subject('ApiToken', { userId: OWNER_ID }) },
    { what: 'revoke a token', action: 'delete', target: subject('ApiToken', { userId: OWNER_ID }) },
    {
      what: 'change the handle',
      action: 'update',
      target: subject('Channel', { id: OWN_CHANNEL, userId: OWNER_ID, ownerId: OWNER_ID }),
    },
    {
      what: 'invite a member',
      action: 'create',
      target: subject('ChannelInvite', { channelId: OWN_CHANNEL, ownerId: OWNER_ID }),
    },
    {
      what: 'remove a member',
      action: 'delete',
      target: subject('ChannelMember', { channelId: OWN_CHANNEL, ownerId: OWNER_ID }),
    },
    { what: 'manage everything', action: 'manage', target: 'all' },
  ])("an admin's token holding every scope cannot $what", ({ action, target }) => {
    const owner = tokenOf(API_SCOPES, { role: 'ADMIN' });

    expect(getUserPermissions(owner).can(action, target)).toBe(false);
  });

  it('builds the same ability for a session without a token', () => {
    const { token: _token, ...session } = tokenOf(['videos:read']);

    expect(getUserPermissions(session).can('delete', video(OWNER_ID))).toBe(true);
  });
});
