import { isErr, ok, type Result } from '@kit/result';
import type {
  ChannelUserRestrictionRepositoryPort,
  CommentSettingsRepositoryPort,
  SubscriptionRepositoryPort,
  TrustedCommenterRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import type { CommentHost, CommentSettings } from '@vp/domain';
import { type CommentGateContext, commentHostTarget, commentHostTraits } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { isChannelTeamMember, type UserContext } from '@vp/permissions';

/** An account with no row is as old as can be, so the age check never refuses it. */
const oldestAccount = (): Date => new Date(0);

export interface CommentGateLookups {
  settings: CommentSettingsRepositoryPort;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
  trusted: Pick<TrustedCommenterRepositoryPort, 'isTrusted'>;
  subscriptions: Pick<SubscriptionRepositoryPort, 'isSubscribed'>;
  users: Pick<UserRepository, 'findById'>;
}

export interface LoadedCommentGate {
  settings: CommentSettings;
  context: CommentGateContext;
}

/**
 * Everything `evaluateCommentGate` reads about the channel the host is on, in one lookup. Bans and
 * trust name the account; a subscription names the channel `authorChannelId` the author writes as.
 */
export async function loadCommentGate(
  lookups: CommentGateLookups,
  author: UserContext,
  authorChannelId: string,
  host: CommentHost,
  now: Date
): Promise<Result<LoadedCommentGate, DatabaseUnavailable>> {
  const { channelId, ownerId, commentsEnabled } = commentHostTraits(host);
  const [settings, restriction, trusted, subscribed, account] = await Promise.all([
    lookups.settings.get(channelId),
    lookups.restrictions.findActive(channelId, author.id, now),
    lookups.trusted.isTrusted(channelId, author.id),
    lookups.subscriptions.isSubscribed(authorChannelId, channelId),
    lookups.users.findById(author.id),
  ]);
  if (isErr(settings)) return settings;
  if (isErr(restriction)) return restriction;
  if (isErr(trusted)) return trusted;
  if (isErr(subscribed)) return subscribed;
  if (isErr(account)) return account;

  return ok({
    settings: settings.value,
    context: {
      now,
      targetId: commentHostTarget(host).id,
      channelId,
      commentsEnabled,
      restriction: restriction.value,
      isTeamMember: isChannelTeamMember({ user: author, channelId, ownerId }),
      isSubscribed: subscribed.value,
      isTrusted: trusted.value,
      accountCreatedAt: account.value?.createdAt ?? oldestAccount(),
    },
  });
}
