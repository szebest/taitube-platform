import { dt } from '../define';
import { studioInvites } from './studio-invites';

const roles = (manager: string, editor: string, moderator: string, analytics: string) =>
  ({ manager, editor, moderator, analytics }) as const;

export const studioTeam = {
  ...studioInvites,
  teamNav: dt('Team'),
  teamTitle: dt('Team'),
  teamTabs: dt('Team sections'),
  teamTabMembers: dt('Members'),
  teamTabAudit: dt('Audit log'),
  teamRole: dt('{role:enum}', {
    enum: { role: roles('Manager', 'Editor', 'Moderator', 'Analytics viewer') },
  }),
  teamRoleSummary: dt('{role:enum}', {
    enum: {
      role: roles(
        'Runs the channel and its team, except other managers.',
        'Uploads and edits videos and the channel page.',
        'Keeps the comments in order.',
        'Reads analytics and videos, changes nothing.'
      ),
    },
  }),
  teamCapability: dt('{capability:enum}', {
    enum: {
      capability: {
        'video.read': 'See private and unlisted videos and their captions',
        'analytics.read': 'Read analytics and exports',
        'video.edit': 'Upload and edit videos, thumbnails and visibility',
        'video.delete': 'Delete videos',
        'channel.edit': 'Edit the channel page and identity',
        'comment.pin': 'Pin comments',
        'content.pin': 'Pin posts and Start here videos',
        'comment.heart': 'Heart comments',
        'comment.moderate': 'Moderate comments',
        'comment.settings': 'Change comment settings and blocked words',
        'data.export': 'Export comments, videos and posts',
        'team.manage': 'Invite people, change roles and read the audit log',
        'channel.own': 'Delete the channel and transfer ownership',
      },
    },
  }),
  teamRoleCanTitle: dt('A {role:enum} can', {
    enum: { role: roles('Manager', 'Editor', 'Moderator', 'Analytics viewer') },
  }),
  teamMembersCaption: dt('The people who work on this channel'),
  teamColumnMember: dt('Member'),
  teamColumnRole: dt('Role'),
  teamColumnJoined: dt('Joined'),
  teamColumnActions: dt('Actions'),
  teamRoleOf: dt('Role of {name}'),
  teamRoleChangeFailed: dt('The role was not changed.'),
  teamRemove: dt('Remove {name}'),
  teamRemoveTitle: dt('Remove {name} from the team?'),
  teamRemoveDescription: dt('They lose access to the studio of this channel at once.'),
  teamRemoveConfirm: dt('Remove'),
  teamRemoved: dt('{name} was removed'),
  teamRemoveFailed: dt('The member was not removed.'),
  teamEmptyTitle: dt('No one else yet'),
  teamEmptyDescription: dt('Invite someone to give them a role in the studio.'),
  teamFailed: dt('The team did not load.'),
  teamNoAccessTitle: dt('Only managers see the team'),
  teamNoAccessDescription: dt('Ask the owner of this channel if you need a different role.'),
  teamInvite: dt('Invite someone'),
  teamInviteTitle: dt('Invite to the team'),
  teamInviteDescription: dt(
    'They get a notification and choose to accept. An invite expires after 14 days.'
  ),
  teamInviteHandle: dt('Channel handle'),
  teamInviteHandleLabel: dt('Find a channel by its handle'),
  teamInviteHandlePlaceholder: dt('Type a handle, without @'),
  teamInviteNoChannel: dt('No channel has that handle'),
  teamInviteChosen: dt('Inviting {name} (@{handle})'),
  teamInviteRole: dt('Role'),
  teamInviteSend: dt('Send invite'),
  teamInviteSent: dt('Invite sent to {name}'),
  teamInviteFailed: dt('The invite was not sent.'),
  teamInviteAlreadyMember: dt('They are already on the team.'),
  teamInviteAlreadyPending: dt('They already have a pending invite.'),
  teamInvitesTitle: dt('Pending invites'),
  teamInvitesCaption: dt('Invites that nobody has answered yet'),
  teamInviteExpires: dt('Expires'),
  teamInviteRevoke: dt('Revoke the invite for {name}'),
  teamInviteRevoked: dt('Invite revoked'),
  teamInviteRevokeFailed: dt('The invite was not revoked.'),
  teamUnknownMember: dt('Unknown channel'),
  teamAuditCaption: dt('What the team changed, newest first'),
  teamAuditEntries: dt('Audit log entries'),
  teamAuditFilterActor: dt('Who'),
  teamAuditFilterAction: dt('What'),
  teamAuditAction: dt('{action:enum}', {
    enum: {
      action: {
        'invite.created': 'Invited someone',
        'invite.accepted': 'Accepted an invite',
        'invite.declined': 'Declined an invite',
        'invite.revoked': 'Revoked an invite',
        'member.role_changed': 'Changed a role',
        'member.removed': 'Removed a member',
        'member.left': 'Left the team',
        'channel.updated': 'Changed the channel',
        'video.updated': 'Edited a video',
        'video.comments.toggled': 'Turned comments on or off',
        'comment.held': 'Held a comment',
        'comment.approved': 'Approved a comment',
        'comment.hidden': 'Hid a comment',
        'comment.unhidden': 'Unhid a comment',
        'comment.removed': 'Removed a comment',
        'comment.pinned': 'Pinned or unpinned a comment',
        'user.shadow_banned': 'Shadow banned a user',
        'user.banned': 'Banned a user',
        'user.restriction_lifted': 'Lifted a restriction',
        'trusted.added': 'Trusted a commenter',
        'trusted.removed': 'Stopped trusting a commenter',
        'settings.comments.updated': 'Changed the comment settings',
      },
    },
  }),
  teamAuditInvited: dt('as {role:enum}', {
    enum: { role: roles('Manager', 'Editor', 'Moderator', 'Analytics viewer') },
  }),
  teamAuditRoleChanged: dt('from {from:enum} to {to:enum}', {
    enum: {
      from: roles('Manager', 'Editor', 'Moderator', 'Analytics viewer'),
      to: roles('Manager', 'Editor', 'Moderator', 'Analytics viewer'),
    },
  }),
  teamAuditVideoFields: dt('{fields:list}', {
    list: { fields: { type: 'conjunction' } },
  }),
  teamAuditField: dt('{field:enum}', {
    enum: {
      field: {
        title: 'title',
        description: 'description',
        visibility: 'visibility',
        categoryId: 'category',
        tags: 'tags',
        thumbnail: 'thumbnail',
      },
    },
  }),
  teamAuditDisclosure: dt('{disclosure:enum}', {
    enum: { disclosure: { silent: 'silently', visible: 'with the author told' } },
  }),
  teamAuditCommentsToggled: dt('{state:enum}', {
    enum: { state: { on: 'comments on', off: 'comments off' } },
  }),
  teamAuditPinned: dt('{state:enum}', {
    enum: { state: { on: 'pinned', off: 'unpinned' } },
  }),
  teamAuditSettingsFields: dt('{fields:list}', {
    list: { fields: { type: 'conjunction' } },
  }),
  teamAuditSettingsField: dt('{field:enum}', {
    enum: {
      field: {
        reviewMode: 'review mode',
        blockedWords: 'blocked words',
        linkAllowlist: 'allowed links',
        slowModeSeconds: 'slow mode',
        subscribersOnly: 'subscribers only',
        minAccountAgeDays: 'account age',
        disclosure: 'what authors are told',
      },
    },
  }),
  teamAuditDeletedActor: dt('A former member'),
  teamAuditEmptyTitle: dt('Nothing here'),
  teamAuditEmptyDescription: dt('Changes the team makes to the channel show up here.'),
  teamAuditFailed: dt('The audit log did not load.'),
  channelSwitch: dt('Switch channel'),
  channelSwitchLabel: dt('Channel you work on'),
  channelSwitchOwn: dt('{name} (yours)'),
} as const;
