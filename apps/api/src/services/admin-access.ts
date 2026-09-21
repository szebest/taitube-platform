import type { AuthorizationPort } from '@vp/core/ports';
import { canAccessAdmin } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';

/**
 * The single admin gate. Services that expose operator endpoints call this with
 * the caller the transport resolved; no route decides admin access for itself.
 */
export function assertAdminAccess(auth: AuthorizationPort, user: AuthUser | null): void {
  auth.assertCan(
    canAccessAdmin,
    { user },
    {
      action: 'access',
      subject: 'Admin',
      user,
      message: user
        ? 'Admin role required to access this resource'
        : 'Authentication required: provide an admin Bearer token or valid x-admin-token header',
    }
  );
}
