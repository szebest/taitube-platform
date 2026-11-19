import { AbilityBuilder, createMongoAbility } from '@casl/ability';
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
import { definePreferencesRules } from './rules/preferences.rules';
import { defineQueueRules } from './rules/queue.rules';
import { defineRecommendationFeedbackRules } from './rules/recommendation-feedback.rules';
import { defineUploadRules } from './rules/upload.rules';
import { defineVideoRules } from './rules/video.rules';
import { defineWatchPartyRules } from './rules/watch-party.rules';
import { defineWebhookRules } from './rules/webhook.rules';
import { onTokenChannel, withinScopes } from './token-scopes';
import type { AppAbility, UserContext } from './types/index';

/**
 * The one place a token is narrowed: the ability is built for the user on the token's channel, then
 * cut down to the token's scopes, so a token never does more than its user can.
 */
export function getUserPermissions(user: UserContext | null): AppAbility {
  const token = user?.token;
  if (!(user && token)) return buildAbility(user);
  const onChannel = onTokenChannel(user, token);
  return withinScopes(buildAbility(onChannel), token);
}

function buildAbility(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  defineVideoRules(user, builder);
  defineCommentRules(user, builder);
  defineCommentModerationRules(user, builder);
  defineChannelRules(user, builder);
  defineChannelTeamRules(user, builder);
  defineChannelExportRules(user, builder);
  defineApiTokenRules(user, builder);
  defineUploadRules(user, builder);
  defineAnalyticsRules(user, builder);
  definePlaylistRules(user, builder);
  definePreferencesRules(user, builder);
  defineCaptionRules(user, builder);
  defineNotificationRules(user, builder);
  defineClipRules(user, builder);
  defineQueueRules(user, builder);
  defineRecommendationFeedbackRules(user, builder);
  defineWebhookRules(user, builder);
  defineLiveStreamRules(user, builder);
  defineWatchPartyRules(user, builder);
  // Last, because a later CASL rule wins: an admin's `manage all` overrides every `cannot` above.
  defineAdminRules(user, builder);

  return builder.build();
}
