import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { defineAdminRules } from './rules/admin.rules';
import { defineAnalyticsRules } from './rules/analytics.rules';
import { defineChannelRules } from './rules/channel.rules';
import { defineCommentRules } from './rules/comment.rules';
import { defineUploadRules } from './rules/upload.rules';
import { defineVideoRules } from './rules/video.rules';
import type { AppAbility, UserContext } from './types/index';

export function getUserPermissions(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  defineAdminRules(user, builder);
  defineVideoRules(user, builder);
  defineCommentRules(user, builder);
  defineChannelRules(user, builder);
  defineUploadRules(user, builder);
  defineAnalyticsRules(user, builder);

  return builder.build();
}
