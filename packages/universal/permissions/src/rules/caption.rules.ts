import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/** Whoever may watch the video may read its captions; its owner and the channel's editors change them. */
export function defineCaptionRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  const { can } = builder;

  can('read', 'Caption', { visibility: 'public' });
  can('read', 'Caption', { visibility: 'unlisted' });

  if (!user) return;

  if (user.role === 'MODERATOR') can('read', 'Caption');

  if (isSignedInRole(user.role)) {
    can('read', 'Caption', { ownerId: user.id });
    can('manage', 'Caption', { ownerId: user.id });
  }

  const readable = channelsWith(user, 'video.read');
  if (readable) can('read', 'Caption', { channelId: readable });

  const editable = channelsWith(user, 'video.edit');
  if (editable) can('manage', 'Caption', { channelId: editable });
}
