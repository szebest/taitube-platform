import { type UserContext, canAccessAdmin } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import {
  type AdminAccessFailure,
  adminAccessDenied,
  adminUnauthorized,
} from './failures.js';

/**
 * The single admin gate, returning its verdict instead of throwing it. An anonymous caller and a
 * signed-in caller without the role are different failures, so the edge can answer 401 or 403
 * rather than guessing from a message.
 */
export function decideAdminAccess(
  user: UserContext | null
): Result<UserContext, AdminAccessFailure> {
  if (!user) return err(adminUnauthorized());
  return canAccessAdmin({ user }) ? ok(user) : err(adminAccessDenied());
}
