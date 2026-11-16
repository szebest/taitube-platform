import type { AbilityBuilder } from '@casl/ability';
import { ANALYTICS_EXPORT_KINDS } from '@vp/domain';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

const EXPORT_ACTIONS = ['create', 'read', 'delete'] as const;

/** The owner and `data.export` reach every kind; `analytics.export` reaches the analytics kinds only. */
export function defineChannelExportRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  const everyKind = channelsWith(user, 'data.export');
  const analyticsKinds = channelsWith(user, 'analytics.export');
  for (const action of EXPORT_ACTIONS) {
    can(action, 'ChannelExport', { ownerId: user.id });
    if (everyKind) can(action, 'ChannelExport', { channelId: everyKind });
    if (analyticsKinds) {
      can(action, 'ChannelExport', {
        channelId: analyticsKinds,
        kind: { $in: [...ANALYTICS_EXPORT_KINDS] },
      });
    }
  }
}
