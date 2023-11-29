import { createContext, useCallback, useContext, useEffect, useMemo } from "react"

import { User } from "../models"
import { useUserDetailsQuery } from "../api/authApiSlice"

type AuthContextValue = {
  user?: User
  isLoading: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export type AuthProviderProps = {
  children: React.ReactNode
}
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { isLoading, data: user } = useUserDetailsQuery();

  const logout = useCallback(() => {
    
  }, [])

  const ctx = useMemo(() => ({
    user,
    isLoading,
    logout,
  }), [user, isLoading])

  useEffect(() => {
    if (window.location.href.indexOf('#_=_') > 0) {
      window.location.href = window.location.href.replace(/#.*/, '');
    }
  }, [])

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