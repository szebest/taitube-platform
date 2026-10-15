import { useQuery } from "@tanstack/react-query"
import { type PropsWithChildren, createContext, useContext, useMemo } from "react"

import type { Account } from "@vp/api-contracts"
import { type UserContext, parseRole } from "@vp/permissions"
import { PermissionsProvider } from "@vp/permissions-react"

import { readAuthToken } from "#app/auth-token"
import { accountQueryOptions } from "#app/features/account/api/account-queries"

type AuthContextValue = {
	account?: Account
	isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function viewerOf(account: Account | undefined): UserContext | null {
	if (!account) return null
	return {
		id: account.user.id,
		role: parseRole((account as { role?: unknown }).role),
		email: account.user.email,
	}
}

export type AuthProviderProps = PropsWithChildren;

/** The signed-in account, and the permissions it grants every component below. */
export const AuthProvider = ({ children }: AuthProviderProps) => {
	const { isLoading, data: account } = useQuery({ ...accountQueryOptions(), enabled: readAuthToken() !== null });

	const ctx = useMemo(() => ({
		account,
		isLoading
	}), [account, isLoading])
	const viewer = useMemo(() => viewerOf(account), [account])

	return (
		<AuthContext.Provider value={ctx}>
			<PermissionsProvider userContext={viewer}>
				{children}
			</PermissionsProvider>
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const ctx = useContext(AuthContext)
	if (!ctx) {
		throw new Error('useAuth must be used within AuthProvider')
	}
	return ctx
}
