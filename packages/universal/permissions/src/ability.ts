import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { defineAdminRules } from './rules/admin.rules';
import { defineAnalyticsRules } from './rules/analytics.rules';
import { defineCaptionRules } from './rules/caption.rules';
import { defineChannelRules } from './rules/channel.rules';
import { defineClipRules } from './rules/clip.rules';
import { defineCommentRules } from './rules/comment.rules';
import { defineNotificationRules } from './rules/notification.rules';
import { definePlaylistRules } from './rules/playlist.rules';
import { definePreferencesRules } from './rules/preferences.rules';
import { defineUploadRules } from './rules/upload.rules';
import { defineVideoRules } from './rules/video.rules';
import { defineWebhookRules } from './rules/webhook.rules';
import type { AppAbility, UserContext } from './types/index';

export function getUserPermissions(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  defineVideoRules(user, builder);
  defineCommentRules(user, builder);
  defineChannelRules(user, builder);
  defineUploadRules(user, builder);
  defineAnalyticsRules(user, builder);
  definePlaylistRules(user, builder);
  definePreferencesRules(user, builder);
  defineCaptionRules(user, builder);
  defineNotificationRules(user, builder);
  defineClipRules(user, builder);
  defineWebhookRules(user, builder);
  // Last, because a later CASL rule wins: an admin's `manage all` overrides every `cannot` above.
  defineAdminRules(user, builder);

  return builder.build();
}
