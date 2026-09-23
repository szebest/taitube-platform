import { type UserContext, canAccessAdmin } from '@vp/permissions';
import type { Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize.js';

const ADMIN_REQUIRED =
  'Authentication required: provide an admin Bearer token or valid x-admin-token header';

/**
 * The single admin gate, returning its verdict instead of throwing it. An anonymous caller and a
 * signed-in caller without the role stay different failures, so the edge answers 401 or 403 rather
 * than guessing from a message.
 */
export function decideAdminAccess(
  user: UserContext | null
): Result<UserContext, AuthorizationFailure> {
  return authorize(user, canAccessAdmin({ user }), {
    action: 'access',
    subject: 'Admin',
    message: user ? 'Admin role required to access this resource' : ADMIN_REQUIRED,
  });
}
