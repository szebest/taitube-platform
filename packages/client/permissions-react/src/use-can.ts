import type { AppAction, AppSubjects, UserContext } from '@vp/permissions';

import { usePermissions } from './permissions-provider';

export type CanHelper<P extends { user: UserContext | null }> = (params: P) => boolean;

/** Whether the viewer may act: a CASL action on a subject, or a rule from `@vp/permissions`. */
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

  if (typeof actionOrHelper === 'function') {
    return actionOrHelper({ ...(subjectOrParams as object), user: userContext } as P);
  }
  return ability.can(actionOrHelper, subjectOrParams as AppSubjects);
}
