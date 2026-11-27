import { createAbilityFactory, type RuleSet } from '@kit/permissions';
import { defineAdminRules } from './rules/admin.rules';
import { defineAnalyticsRules } from './rules/analytics.rules';
import { defineApiTokenRules } from './rules/api-token.rules';
import { defineCaptionRules } from './rules/caption.rules';
import { defineChannelExportRules } from './rules/channel-export.rules';
import { defineChannelTeamRules } from './rules/channel-team.rules';
import { defineChannelRules } from './rules/channel.rules';
import { defineClipRules } from './rules/clip.rules';
import { defineCommentModerationRules } from './rules/comment-moderation.rules';
import { defineCommentRules } from './rules/comment.rules';
import { defineLiveStreamRules } from './rules/live-stream.rules';
import { defineNotificationRules } from './rules/notification.rules';
import { definePlaylistRules } from './rules/playlist.rules';
import { definePostRules } from './rules/post.rules';
import { definePreferencesRules } from './rules/preferences.rules';
import { defineQueueRules } from './rules/queue.rules';
import { defineRecommendationFeedbackRules } from './rules/recommendation-feedback.rules';
import { defineShareLinkRules } from './rules/share-link.rules';
import { defineThreadRules } from './rules/thread.rules';
import { defineUploadRules } from './rules/upload.rules';
import { defineVideoRules } from './rules/video.rules';
import { defineWatchPartyRules } from './rules/watch-party.rules';
import { defineWebhookRules } from './rules/webhook.rules';
import { onTokenChannel, withinScopes } from './token-scopes';
import type { AppAbility, AppAction, AppSubjects, ShareGrant, UserContext } from './types/index';

interface AbilityContext {
  readonly user: UserContext | null;
  readonly share: ShareGrant | null;
}

const forUser =
  (
    define: RuleSet<AppAction, AppSubjects, UserContext | null>
  ): RuleSet<AppAction, AppSubjects, AbilityContext> =>
  ({ user }, builder) =>
    define(user, builder);

const buildAbility = createAbilityFactory<AppAction, AppSubjects, AbilityContext>([
  forUser(defineVideoRules),
  ({ share }, builder) => defineShareLinkRules(share, builder),
  forUser(defineCommentRules),
  forUser(defineCommentModerationRules),
  forUser(defineChannelRules),
  forUser(defineChannelTeamRules),
  forUser(defineChannelExportRules),
  forUser(defineApiTokenRules),
  forUser(defineUploadRules),
  forUser(defineAnalyticsRules),
  forUser(definePlaylistRules),
  forUser(definePostRules),
  forUser(defineThreadRules),
  forUser(definePreferencesRules),
  forUser(defineCaptionRules),
  forUser(defineNotificationRules),
  forUser(defineClipRules),
  forUser(defineQueueRules),
  forUser(defineRecommendationFeedbackRules),
  forUser(defineWebhookRules),
  forUser(defineLiveStreamRules),
  forUser(defineWatchPartyRules),
  // Last, because a later CASL rule wins: an admin's `manage all` overrides every `cannot` above.
  forUser(defineAdminRules),
]);

/**
 * The one place a token is narrowed: the ability is built for the user on the token's channel, then
 * cut down to the token's scopes, so a token never does more than its user can.
 */
export function getUserPermissions(
  user: UserContext | null,
  share: ShareGrant | null = null
): AppAbility {
  const token = user?.token;
  if (!(user && token)) return buildAbility({ user, share });
  const onChannel = onTokenChannel(user, token);
  return withinScopes(buildAbility({ user: onChannel, share }), token);
}
