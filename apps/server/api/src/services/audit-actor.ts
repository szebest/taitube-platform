import type { AuditActor } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

/** Who an audit entry names: the user, and the personal access token when the request carried one. */
export function auditActor({ id, token }: UserContext): AuditActor {
  return token ? { actorUserId: id, actorTokenId: token.id } : { actorUserId: id };
}
