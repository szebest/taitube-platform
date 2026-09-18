import { POLICIES } from './policies';
import type { Action, Resource, Role, UserContext } from './types';

export function normalizeRole(role?: string | null): Role {
  if (!role) {
    return 'GUEST';
  }
  const upper = role.toUpperCase();
  if (upper === 'ADMIN') {
    return 'ADMIN';
  }
  if (upper === 'MODERATOR') {
    return 'MODERATOR';
  }
  if (upper === 'CREATOR') {
    return 'CREATOR';
  }
  if (upper === 'USER') {
    return 'USER';
  }
  return 'GUEST';
}

export function can(user: UserContext | null, action: Action, resource?: Resource): boolean {
  if (!user) {
    const rule = POLICIES[action];
    return rule ? rule(null, resource) : false;
  }

  const role = normalizeRole(user.role);
  const normalizedUser: UserContext = {
    ...user,
    role,
  };

  // Superuser bypass: ADMIN can do anything
  if (role === 'ADMIN') {
    return true;
  }

  const rule = POLICIES[action];
  if (!rule) {
    return false;
  }

  return rule(normalizedUser, resource);
}
