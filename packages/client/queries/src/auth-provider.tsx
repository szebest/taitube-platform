import { useQuery } from '@tanstack/react-query';
import type { Account } from '@vp/api-contracts';
import { type UserContext, parseRole } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import { type PropsWithChildren, createContext, useContext, useMemo } from 'react';

import { accountQueryOptions } from './account-queries';
import { useApi } from './api-provider';
import { readAuthToken } from './auth-token';

export type AuthContextValue = {
  account?: Account;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function viewerOf(account: Account | undefined): UserContext | null {
  if (!account) return null;
  return {
    id: account.user.id,
    role: parseRole((account as { role?: unknown }).role),
    email: account.user.email,
  };
}

export type AuthProviderProps = PropsWithChildren;

/** The signed-in account, and the permissions it grants every component below. */
export function AuthProvider({ children }: AuthProviderProps) {
  const api = useApi();
  const { isLoading, data: account } = useQuery({
    ...accountQueryOptions(api),
    enabled: readAuthToken() !== null,
  });

  const value = useMemo(() => ({ account, isLoading }), [account, isLoading]);
  const viewer = useMemo(() => viewerOf(account), [account]);

  return (
    <AuthContext value={value}>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return auth;
}
