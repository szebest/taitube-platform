import type {
  ChannelRepositoryPort,
  ChannelUserRestrictionRepositoryPort,
  CommentSettingsRepositoryPort,
  SubscriptionRepositoryPort,
  TrustedCommenterRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import type { CommentSettings, Video } from '@vp/domain';
import type { CommentGateContext } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { isChannelTeamMember, type UserContext } from '@vp/permissions';
import { isErr, ok, type Result } from '@vp/result';

export interface CommentGateLookups {
  channels: Pick<ChannelRepositoryPort, 'findByUserId'>;
  settings: CommentSettingsRepositoryPort;
  restrictions: Pick<ChannelUserRestrictionRepositoryPort, 'findActive'>;
  trusted: Pick<TrustedCommenterRepositoryPort, 'isTrusted'>;
  subscriptions: Pick<SubscriptionRepositoryPort, 'isSubscribed'>;
  users: Pick<UserRepository, 'findById'>;
}

export interface LoadedCommentGate {
  channelId: string;
  settings: CommentSettings;
  context: CommentGateContext;
}

/**
 * Everything `evaluateCommentGate` reads, in one lookup. A video whose owner has no channel has no
 * settings, restrictions or trusted list, so it has no gate either.
 */
export async function loadCommentGate(
  lookups: CommentGateLookups,
  author: UserContext,
  video: Video,
  now: Date
): Promise<Result<LoadedCommentGate | null, DatabaseUnavailable>> {
  const channel = await lookups.channels.findByUserId(video.ownerId);
  if (isErr(channel)) return channel;
  if (!channel.value) return ok(null);
  const channelId = channel.value.id;

  const [settings, restriction, trusted, subscribed, account] = await Promise.all([
    lookups.settings.get(channelId),
    lookups.restrictions.findActive(channelId, author.id, now),
    lookups.trusted.isTrusted(channelId, author.id),
    lookups.subscriptions.isSubscribed(author.id, channelId),
    lookups.users.findById(author.id),
  ]);
  if (isErr(settings)) return settings;
  if (isErr(restriction)) return restriction;
  if (isErr(trusted)) return trusted;
  if (isErr(subscribed)) return subscribed;
  if (isErr(account)) return account;

  return ok({
    channelId,
    settings: settings.value,
    context: {
      now,
      videoId: video.id,
      channelId,
      commentsEnabled: video.commentsEnabled ?? true,
      restriction: restriction.value,
      isTeamMember: isChannelTeamMember({ user: author, channelId, ownerId: video.ownerId }),
      isSubscribed: subscribed.value,
      isTrusted: trusted.value,
      accountCreatedAt: account.value?.createdAt ?? new Date(0),
    },
  });
}
