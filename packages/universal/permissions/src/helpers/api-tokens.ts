import { subject } from '@casl/ability';
import type { ApiScope } from '@vp/domain';
import { getUserPermissions } from '../ability';
import type { ApiTokenResource, UserContext } from '../types/index';

interface OnToken {
  user: UserContext | null;
  apiToken: ApiTokenResource;
}

export function canCreateApiToken({ user, apiToken }: OnToken): boolean {
  return getUserPermissions(user).can('create', subject('ApiToken', { ...apiToken }));
}

export function canReadApiToken({ user, apiToken }: OnToken): boolean {
  return getUserPermissions(user).can('read', subject('ApiToken', { ...apiToken }));
}

export function canRevokeApiToken({ user, apiToken }: OnToken): boolean {
  return getUserPermissions(user).can('delete', subject('ApiToken', { ...apiToken }));
}

/**
 * Whether the request may reach a route that names `scope`: always without a token; with one,
 * only a route that names a scope the token holds. A route with no scope is out of a token's reach.
 */
export function canCallWithToken({
  user,
  scope,
}: {
  user: UserContext | null;
  scope: ApiScope | undefined;
}): boolean {
  const token = user?.token;
  if (!token) return true;
  return scope !== undefined && token.scopes.includes(scope);
}
