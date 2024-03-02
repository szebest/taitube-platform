import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from "react"
import { toast } from "react-toastify"

import { User } from "../models"
import { useUserDetailsQuery } from "../api/authApiSlice"

type AuthContextValue = {
	user?: User
	isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export type AuthProviderProps = PropsWithChildren;

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const { isLoading, data: user } = useUserDetailsQuery();

	const ctx = useMemo(() => ({
		user,
		isLoading
	}), [user, isLoading])

	useEffect(() => {
		if (window.location.href.indexOf('#_=_') > 0) {
			window.location.href = window.location.href.replace(/#.*/, '');
		}
	}, [])

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		if (isLoading) {
			timeoutId = setTimeout(() => {
				toast("The backend is delayed with the user info...")
			}, 2000);
		}

		return () => {
			timeoutId && clearTimeout(timeoutId);
		}
	}, [isLoading])

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