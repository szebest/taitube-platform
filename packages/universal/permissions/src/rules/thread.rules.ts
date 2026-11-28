import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/** Starting a thread is a comment's rule; pinning one is the video channel's, taking one down is its author's. */
export function defineThreadRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  can('delete', 'Thread', { authorId: user.id });
  can('pin', 'Thread', { ownerId: user.id });
  const pinnable = channelsWith(user, 'content.pin');
  if (pinnable) can('pin', 'Thread', { channelId: pinnable });
}
