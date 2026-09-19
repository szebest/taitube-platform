import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { useMemo } from 'react';
import { usePermissions } from '../modules/shared/providers/permissions-provider';

export type CanHelper<P extends { user: UserContext | null }> = (params: P) => boolean;

/**
 * Headless React hook evaluating declarative permissions in O(1) time
 * using the memoized CASL ability from PermissionsProvider.
 * Enforces Rule 14: Zero complex logic or permission calculations in UI components.
 */
export function useCan(action: AppAction, subject: AppSubjects): boolean;
export function useCan<P extends { user: UserContext | null }>(
  helper: CanHelper<P>,
  params?: Omit<P, 'user'>
): boolean;
export function useCan<P extends { user: UserContext | null }>(
  actionOrHelper: AppAction | CanHelper<P>,
  subjectOrParams?: AppSubjects | Omit<P, 'user'>
): boolean {
  const { ability, userContext } = usePermissions();

  return useMemo(() => {
    if (typeof actionOrHelper === 'function') {
      const helper = actionOrHelper;
      return helper({
        ...(subjectOrParams as object),
        user: userContext,
      } as P);
    }
    return ability.can(actionOrHelper, subjectOrParams as AppSubjects);
  }, [ability, userContext, actionOrHelper, subjectOrParams]);
}
