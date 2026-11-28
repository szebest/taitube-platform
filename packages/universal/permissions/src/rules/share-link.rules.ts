import type { AbilityBuilder } from '@casl/ability';
import type { AppAbility, ShareGrant } from '../types/index';

const LINKED_SUBJECT = { video: 'Video', playlist: 'Playlist' } as const;

/** `read` on the linked video or playlist alone: no comment, reaction, stats or edit rides on a link. */
export function defineShareLinkRules(
  grant: ShareGrant | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (grant === null) return;
  builder.can('read', LINKED_SUBJECT[grant.targetType], { id: grant.targetId });
}
