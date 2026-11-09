import { subject } from '@casl/ability';
import { CHANNEL_ROLE_NAMES, type ChannelCapability, roleHas } from '@vp/domain';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';

type SubjectType =
  | 'Video'
  | 'Comment'
  | 'Channel'
  | 'Analytics'
  | 'Caption'
  | 'Upload'
  | 'Team'
  | 'ChannelUser'
  | 'CommentSettings';

interface Probe {
  type: SubjectType;
  action: AppAction;
  target: AppSubjects;
}

const CHANNEL_ID = 'chan-team';
const OWNER_ID = 'owner-team';

const privateVideo = subject('Video', {
  id: 'vid-team',
  ownerId: OWNER_ID,
  visibility: 'private' as const,
});
const comment = subject('Comment', {
  id: 'comment-team',
  authorId: 'fan-1',
  videoOwnerId: OWNER_ID,
});
const channel = subject('Channel', { id: CHANNEL_ID, userId: OWNER_ID, ownerId: OWNER_ID });
const channelUser = subject('ChannelUser', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
const commentSettings = subject('CommentSettings', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
const editor = subject('ChannelMember', {
  channelId: CHANNEL_ID,
  ownerId: OWNER_ID,
  userId: 'member-colleague',
  role: 'editor' as const,
});
const editorInvite = subject('ChannelInvite', {
  channelId: CHANNEL_ID,
  ownerId: OWNER_ID,
  inviteeUserId: 'invitee-1',
  role: 'editor' as const,
});

/** Every capability is probed or marked pending until its first action exists: the Record keeps it complete. */
const CAPABILITY_PROBES: Record<ChannelCapability, Probe[] | { pending: '118' }> = {
  'video.read': [
    { type: 'Video', action: 'read', target: privateVideo },
    {
      type: 'Caption',
      action: 'read',
      target: subject('Caption', {
        videoId: 'vid-team',
        ownerId: OWNER_ID,
        visibility: 'private' as const,
      }),
    },
  ],
  'analytics.read': [
    { type: 'Analytics', action: 'read', target: subject('Analytics', { ownerId: OWNER_ID }) },
  ],
  'video.edit': [
    { type: 'Video', action: 'update', target: privateVideo },
    {
      type: 'Caption',
      action: 'manage',
      target: subject('Caption', {
        videoId: 'vid-team',
        ownerId: OWNER_ID,
        visibility: 'public' as const,
      }),
    },
    { type: 'Upload', action: 'access', target: subject('Upload', { ownerId: OWNER_ID }) },
  ],
  'video.delete': [{ type: 'Video', action: 'delete', target: privateVideo }],
  'channel.edit': [{ type: 'Channel', action: 'update', target: channel }],
  'comment.pin': [{ type: 'Comment', action: 'pin', target: comment }],
  'content.pin': [{ type: 'Video', action: 'pin', target: privateVideo }],
  'comment.heart': [{ type: 'Comment', action: 'heart', target: comment }],
  'comment.moderate': [
    { type: 'Comment', action: 'moderate', target: comment },
    { type: 'Comment', action: 'delete', target: comment },
    ...(['hold', 'approve', 'hide', 'unhide', 'remove'] as const).map((action) => ({
      type: 'Comment' as const,
      action,
      target: comment,
    })),
    { type: 'ChannelUser', action: 'restrict', target: channelUser },
  ],
  'comment.settings': [
    { type: 'CommentSettings', action: 'read', target: commentSettings },
    { type: 'CommentSettings', action: 'update', target: commentSettings },
  ],
  'data.export': { pending: '118' },
  'team.manage': [
    {
      type: 'Team',
      action: 'read',
      target: subject('ChannelAudit', { channelId: CHANNEL_ID, ownerId: OWNER_ID }),
    },
    { type: 'Team', action: 'create', target: editorInvite },
    { type: 'Team', action: 'update', target: editor },
    { type: 'Team', action: 'delete', target: editor },
  ],
  'channel.own': [{ type: 'Channel', action: 'delete', target: channel }],
};

const owner: UserContext = { id: OWNER_ID, role: 'CREATOR' };

const memberOf = (role: (typeof CHANNEL_ROLE_NAMES)[number]): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { [CHANNEL_ID]: { role, ownerId: OWNER_ID } },
});

/** A member of another channel: a role somewhere must not leak onto this one. */
const stranger: UserContext = {
  id: 'stranger',
  role: 'CREATOR',
  memberships: { 'chan-other': { role: 'manager', ownerId: 'owner-other' } },
};

export interface MatrixCell {
  persona: string;
  capability: ChannelCapability;
  action: AppAction;
  user: UserContext;
  target: AppSubjects;
  expected: boolean;
}

/** One cell per capability, action and persona: the owner, each role and an unrelated user. */
export function matrixCells(type: SubjectType): MatrixCell[] {
  return (Object.keys(CAPABILITY_PROBES) as ChannelCapability[]).flatMap((capability) => {
    const probes = CAPABILITY_PROBES[capability];
    if (!Array.isArray(probes)) return [];

    return probes
      .filter((probe) => probe.type === type)
      .flatMap(({ action, target }) => [
        { persona: 'owner', capability, action, user: owner, target, expected: true },
        ...CHANNEL_ROLE_NAMES.map((role) => ({
          persona: role,
          capability,
          action,
          user: memberOf(role),
          target,
          expected: roleHas(role, capability),
        })),
        { persona: 'stranger', capability, action, user: stranger, target, expected: false },
      ]);
  });
}
