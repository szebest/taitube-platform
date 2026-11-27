import { subject } from '@casl/ability';
import { CHANNEL_ROLE_NAMES, type ChannelCapability, roleHas } from '@vp/domain';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';

type SubjectType =
  | 'Video'
  | 'Comment'
  | 'Channel'
  | 'Analytics'
  | 'VideoStats'
  | 'Caption'
  | 'Upload'
  | 'Team'
  | 'ChannelUser'
  | 'CommentSettings'
  | 'ChannelExport'
  | 'Post'
  | 'PostStats'
  | 'Thread';

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
  channelId: CHANNEL_ID,
  visibility: 'private' as const,
});
const comment = subject('Comment', {
  id: 'comment-team',
  authorId: 'fan-1',
  videoOwnerId: OWNER_ID,
  videoChannelId: CHANNEL_ID,
});
const channel = subject('Channel', { id: CHANNEL_ID, userId: OWNER_ID, ownerId: OWNER_ID });
const post = subject('Post', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
const thread = subject('Thread', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
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

const exportOf = (kind: 'channel_analytics' | 'comments') =>
  subject('ChannelExport', { channelId: CHANNEL_ID, ownerId: OWNER_ID, kind });

const exportProbes = (kind: 'channel_analytics' | 'comments'): Probe[] =>
  (['create', 'read', 'delete'] as const).map((action) => ({
    type: 'ChannelExport',
    action,
    target: exportOf(kind),
  }));

/** Every capability is probed: the Record keeps it complete. */
const CAPABILITY_PROBES: Record<ChannelCapability, Probe[]> = {
  'video.read': [
    { type: 'Video', action: 'read', target: privateVideo },
    {
      type: 'Caption',
      action: 'read',
      target: subject('Caption', {
        videoId: 'vid-team',
        ownerId: OWNER_ID,
        channelId: CHANNEL_ID,
        visibility: 'private' as const,
      }),
    },
  ],
  'analytics.read': [
    {
      type: 'Analytics',
      action: 'read',
      target: subject('Analytics', { ownerId: OWNER_ID, channelId: CHANNEL_ID }),
    },
    {
      type: 'VideoStats',
      action: 'read',
      target: subject('VideoStats', { ownerId: OWNER_ID, channelId: CHANNEL_ID }),
    },
    {
      type: 'PostStats',
      action: 'read',
      target: subject('PostStats', { ownerId: OWNER_ID, channelId: CHANNEL_ID }),
    },
  ],
  'video.edit': [
    { type: 'Video', action: 'update', target: privateVideo },
    {
      type: 'Caption',
      action: 'manage',
      target: subject('Caption', {
        videoId: 'vid-team',
        ownerId: OWNER_ID,
        channelId: CHANNEL_ID,
        visibility: 'public' as const,
      }),
    },
    {
      type: 'Upload',
      action: 'access',
      target: subject('Upload', { ownerId: OWNER_ID, channelId: CHANNEL_ID }),
    },
  ],
  'video.delete': [{ type: 'Video', action: 'delete', target: privateVideo }],
  'channel.edit': [{ type: 'Channel', action: 'update', target: channel }],
  'channel.act': [{ type: 'Channel', action: 'act', target: channel }],
  'comment.pin': [{ type: 'Comment', action: 'pin', target: comment }],
  'content.pin': [
    { type: 'Video', action: 'pin', target: privateVideo },
    { type: 'Post', action: 'pin', target: post },
    { type: 'Thread', action: 'pin', target: thread },
  ],
  'post.manage': (['create', 'update', 'delete'] as const).map((action) => ({
    type: 'Post' as const,
    action,
    target: post,
  })),
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
  'analytics.export': exportProbes('channel_analytics'),
  'data.export': exportProbes('comments'),
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
  'channel.own': [
    { type: 'Channel', action: 'delete', target: channel },
    { type: 'Channel', action: 'own', target: channel },
  ],
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
    return CAPABILITY_PROBES[capability]
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

const SIBLING_CHANNEL_ID = 'chan-sibling';
const SIBLING_TYPES: readonly SubjectType[] = [
  'Video',
  'Comment',
  'Caption',
  'Analytics',
  'VideoStats',
  'Upload',
];

const onSiblingChannel = ({ type, target }: Probe): AppSubjects => {
  if (typeof target === 'string') return target;
  const key = type === 'Comment' ? 'videoChannelId' : 'channelId';
  return subject(type, { ...target, [key]: SIBLING_CHANNEL_ID }) as AppSubjects;
};

export interface SiblingCell {
  persona: string;
  capability: ChannelCapability;
  action: AppAction;
  user: UserContext;
  home: AppSubjects;
  sibling: AppSubjects;
}

/** The owner and each role that holds the capability, with the same resource on the owner's other channel. */
export function siblingCells(): SiblingCell[] {
  return (Object.keys(CAPABILITY_PROBES) as ChannelCapability[]).flatMap((capability) =>
    CAPABILITY_PROBES[capability]
      .filter((probe) => SIBLING_TYPES.includes(probe.type))
      .flatMap((probe) =>
        [
          { persona: 'owner', user: owner },
          ...CHANNEL_ROLE_NAMES.filter((role) => roleHas(role, capability)).map((role) => ({
            persona: role,
            user: memberOf(role),
          })),
        ].map(({ persona, user }) => ({
          persona,
          capability,
          action: probe.action,
          user,
          home: probe.target,
          sibling: onSiblingChannel(probe),
        }))
      )
  );
}
