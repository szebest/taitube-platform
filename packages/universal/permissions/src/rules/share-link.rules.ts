import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, ShareGrant } from '../types/index';

/** `read` on the linked video alone: no comment, reaction, stats or edit rides on a link. */
export function defineShareLinkRules(
  grant: ShareGrant | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (grant?.targetType !== 'video') return;
  builder.can('read', 'Video', { id: grant.targetId });
}
