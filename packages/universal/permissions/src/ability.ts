import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { defineAdminRules } from './rules/admin.rules.js';
import { defineChannelRules } from './rules/channel.rules.js';
import { defineCommentRules } from './rules/comment.rules.js';
import { defineUploadRules } from './rules/upload.rules.js';
import { defineVideoRules } from './rules/video.rules.js';
import type { AppAbility, UserContext } from './types/index.js';

export function getUserPermissions(user: UserContext | null): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  defineAdminRules(user, builder);
  defineVideoRules(user, builder);
  defineCommentRules(user, builder);
  defineChannelRules(user, builder);
  defineUploadRules(user, builder);

  return builder.build();
}
