import { PropsWithChildren, createContext, useContext, useMemo } from "react"

import type { Account } from "@vp/api-contracts"

import { readAuthToken } from "src/auth-token"

import { useAccountQuery } from "../api"

type AuthContextValue = {
	account?: Account
	isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export type AuthProviderProps = PropsWithChildren;

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const { isLoading, data: account } = useAccountQuery(undefined, { skip: !readAuthToken() });

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

export const useAuth = () => {
	const ctx = useContext(AuthContext)
	if (!ctx) {
		throw new Error('useAuth must be used within AuthProvider')
	}
	return ctx
}
