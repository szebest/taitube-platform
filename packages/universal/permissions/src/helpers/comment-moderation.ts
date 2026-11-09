import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type {
  AppAction,
  ChannelUserResource,
  CommentSettingsResource,
  UserContext,
} from '../types/index';

type CommentModerationAction = Extract<
  AppAction,
  'hold' | 'approve' | 'hide' | 'unhide' | 'remove'
>;

/** One check per action, because the rules grant each by capability and a role may drop one later. */
export function canModerateComment({
  user,
  action,
  videoOwnerId,
}: {
  user: UserContext | null;
  action: CommentModerationAction;
  videoOwnerId: string;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can(action, subject('Comment', { videoOwnerId }));
}

/** Shadow ban, ban and lift. */
export function canRestrictChannelUser({
  user,
  channel,
}: {
  user: UserContext | null;
  channel: ChannelUserResource;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('restrict', subject('ChannelUser', { ...channel }));
}

export function canUpdateCommentSettings({
  user,
  channel,
}: {
  user: UserContext | null;
  channel: CommentSettingsResource;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('update', subject('CommentSettings', { ...channel }));
}

export function canReadCommentSettings({
  user,
  channel,
}: {
  user: UserContext | null;
  channel: CommentSettingsResource;
}): boolean {
  if (!user) return false;
  return getUserPermissions(user).can('read', subject('CommentSettings', { ...channel }));
}

/**
 * The owner, a manager or a moderator of the channel: the people the comment gate never limits.
 * A membership names the channel it is held on, so a role elsewhere does not count here.
 */
export function isChannelTeamMember({
  user,
  channelId,
  ownerId,
}: {
  user: UserContext | null;
  channelId: string;
  ownerId: string;
}): boolean {
  if (!user) return false;
  return user.id === ownerId || user.memberships?.[channelId] !== undefined;
}
