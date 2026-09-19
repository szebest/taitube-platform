import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
  assertCan,
  getUserPermissions,
  parseRole,
} from '@vp/permissions';
import { useAuth } from './auth-provider';

export interface PermissionsContextValue {
  ability: AppAbility;
  userContext: UserContext | null;
  can: (action: AppAction, subject: AppSubjects) => boolean;
  cannot: (action: AppAction, subject: AppSubjects) => boolean;
  assertCan: (action: AppAction, subject: AppSubjects, message?: string) => void;
}

export interface PermissionsProviderProps extends PropsWithChildren {
  userContext?: UserContext | null;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

function useSafeAuthUser(): UserContext | null {
  try {
    const { user } = useAuth();
    if (!user) return null;
    return {
      id: String(user.id),
      role: parseRole((user as { role?: unknown }).role),
      email: user.email,
    };
  } catch {
    return null;
  }
}

export function PermissionsProvider({
  userContext: explicitUserContext,
  children,
}: PermissionsProviderProps) {
  const authUserContext = useSafeAuthUser();

  const userContext =
    explicitUserContext !== undefined ? explicitUserContext : authUserContext;

  const ability = useMemo(() => getUserPermissions(userContext), [userContext]);

  const can = useCallback(
    (action: AppAction, subject: AppSubjects): boolean => {
      return ability.can(action, subject);
    },
    [ability]
  );

  const cannot = useCallback(
    (action: AppAction, subject: AppSubjects): boolean => {
      return !ability.can(action, subject);
    },
    [ability]
  );

  const assertCanCallback = useCallback(
    (action: AppAction, subject: AppSubjects, message?: string): void => {
      const allowed = ability.can(action, subject);
      assertCan(allowed, {
        action,
        subject: typeof subject === 'string' ? subject : 'Resource',
        user: userContext,
        message,
      });
    },
    [ability, userContext]
  );

  const value = useMemo(
    () => ({
      ability,
      userContext,
      can,
      cannot,
      assertCan: assertCanCallback,
    }),
    [ability, userContext, can, cannot, assertCanCallback]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return ctx;
}
