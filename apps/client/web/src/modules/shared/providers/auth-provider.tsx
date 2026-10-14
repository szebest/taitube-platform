import { useQuery } from "@tanstack/react-query"
import { type PropsWithChildren, createContext, useContext, useMemo } from "react"

import type { Account } from "@vp/api-contracts"

import { readAuthToken } from "#app/auth-token"
import { accountQueryOptions } from "#app/features/account/api/account-queries"

type AuthContextValue = {
	account?: Account
	isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export type AuthProviderProps = PropsWithChildren;

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const { isLoading, data: account } = useQuery({ ...accountQueryOptions(), enabled: readAuthToken() !== null });

	const ctx = useMemo(() => ({
		account,
		isLoading
	}), [account, isLoading])

	return (
		<AuthContext.Provider value={ctx}>
			{children}
		</AuthContext.Provider>
	)
}

export const useOptionalAuth = (): AuthContextValue | undefined => useContext(AuthContext)

export const useAuth = () => {
	const ctx = useOptionalAuth()
	if (!ctx) {
		throw new Error('useAuth must be used within AuthProvider')
	}
	return ctx
}
