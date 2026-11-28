import type { ActingChannel, NewChannelAuditEntry } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';

export type PageAuditEntry = Extract<NewChannelAuditEntry, { targetType: 'page' }>;

export type PageEvent = PageAuditEntry extends infer Entry
  ? Entry extends { action: infer Action; meta: infer Meta }
    ? { action: Action; meta: Meta }
    : never
  : never;

export function pageAudit(
  user: UserContext,
  acting: ActingChannel,
  event: PageEvent
): PageAuditEntry {
  return {
    channelId: acting.channelId,
    ...auditActor(user),
    targetType: 'page',
    targetId: acting.channelId,
    ...event,
  };
}
