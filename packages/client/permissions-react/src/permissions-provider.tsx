import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
  assertCan,
  getUserPermissions,
} from '@vp/permissions';
import { type PropsWithChildren, createContext, useContext, useMemo } from 'react';

export interface PermissionsContextValue {
  ability: AppAbility;
  userContext: UserContext | null;
  can: (action: AppAction, subject: AppSubjects) => boolean;
  cannot: (action: AppAction, subject: AppSubjects) => boolean;
  assertCan: (action: AppAction, subject: AppSubjects, message?: string) => void;
}

export interface PermissionsProviderProps extends PropsWithChildren {
  /** The signed-in viewer, or `null` for a guest. The app decides it from its session. */
  userContext: UserContext | null;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

function permissionsFor(userContext: UserContext | null): PermissionsContextValue {
  const ability = getUserPermissions(userContext);
  return {
    ability,
    userContext,
    can: (action, subject) => ability.can(action, subject),
    cannot: (action, subject) => !ability.can(action, subject),
    assertCan: (action, subject, message) =>
      assertCan(ability.can(action, subject), {
        action,
        subject: typeof subject === 'string' ? subject : 'Resource',
        user: userContext,
        message,
      }),
  };
}

export function PermissionsProvider({ userContext, children }: PermissionsProviderProps) {
  const value = useMemo(() => permissionsFor(userContext), [userContext]);

  return <PermissionsContext value={value}>{children}</PermissionsContext>;
}

export function usePermissions(): PermissionsContextValue {
  const permissions = useContext(PermissionsContext);
  if (!permissions) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return permissions;
}
