import { type Result, assertNever } from '@kit/result';
import {
  type UserContext,
  canCreateApiToken,
  canReadApiToken,
  canRevokeApiToken,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';

type TokenAccess = 'create' | 'read' | 'delete';

function allows(user: UserContext | null, access: TokenAccess): boolean {
  const apiToken = { userId: user?.id ?? '' };
  switch (access) {
    case 'create':
      return canCreateApiToken({ user, apiToken });
    case 'read':
      return canReadApiToken({ user, apiToken });
    case 'delete':
      return canRevokeApiToken({ user, apiToken });
    default:
      return assertNever(access, 'TokenAccess');
  }
}

/** Decided before any lookup: a token never manages tokens, whatever its scopes. */
export function decideApiTokenAccess({
  user,
  access,
}: {
  user: UserContext | null;
  access: TokenAccess;
}): Result<UserContext, AuthorizationFailure> {
  return authorize(user, allows(user, access), { action: access, subject: 'ApiToken' });
}
