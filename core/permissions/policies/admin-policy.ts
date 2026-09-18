import type { PolicyRule, UserContext } from '../types';

export const canManageCategory: PolicyRule = (user: UserContext | null): boolean => {
  return Boolean(user && user.role === 'ADMIN');
};

export const canViewAllAnalytics: PolicyRule = (user: UserContext | null): boolean => {
  return Boolean(user && user.role === 'ADMIN');
};
