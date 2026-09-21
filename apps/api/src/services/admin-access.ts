import type { AuthorizationPort } from '@vp/core/ports';
import { type UserContext, canAccessAdmin, parseRole } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';

/**
 * The single admin gate. Services that expose operator endpoints call this with
 * the caller the transport resolved; no route decides admin access for itself.
 */
export function assertAdminAccess(auth: AuthorizationPort, user: AuthUser | null): void {
  const userContext: UserContext | null = user ? { id: user.id, role: parseRole(user.role) } : null;

  auth.assertCan(
    canAccessAdmin,
    { user: userContext },
    {
      action: 'access',
      subject: 'Admin',
      user: userContext,
      message: userContext
        ? 'Admin role required to access this resource'
        : 'Authentication required: provide an admin Bearer token or valid x-admin-token header',
    }
  );
}
