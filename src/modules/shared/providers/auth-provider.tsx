import { createContext, useCallback, useContext, useEffect, useMemo } from "react"

import { User } from "../models"
import { useUserDetailsQuery } from "../api/authApiSlice"
import LoadingSpinner from "../components/loading-spinner/loading-spinner"

type AuthContextValue = {
  user?: User
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: React.ReactNode
}
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { isLoading, data: user } = useUserDetailsQuery();

  const logout = useCallback(() => {
    
  }, [])

  const ctx = useMemo(() => ({
    user,
    logout,
  }), [user])

  useEffect(() => {
    if (window.location.href.indexOf('#_=_') > 0) {
      window.location.href = window.location.href.replace(/#.*/, '');
    }
  }, [])

  return (
    <AuthContext.Provider value={ctx}>
      {isLoading ? <LoadingSpinner /> : children}
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