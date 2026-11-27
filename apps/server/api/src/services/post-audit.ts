import type { NewChannelAuditEntry, PostPayload } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';

type PostAuditAction = Extract<NewChannelAuditEntry, { targetType: 'post' }>['action'];

export function postAuditOf(
  action: PostAuditAction,
  user: UserContext,
  channelId: string,
  post: { id: string; payload: PostPayload }
): NewChannelAuditEntry {
  return {
    channelId,
    ...auditActor(user),
    action,
    targetType: 'post',
    targetId: post.id,
    meta: { kind: post.payload.kind },
  };
}
