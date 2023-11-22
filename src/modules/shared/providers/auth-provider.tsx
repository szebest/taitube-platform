import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { User } from "../models"
import { useUserDetailsQuery } from "../api/authApiSlice"
import LoadingSpinner from "../components/loading-spinner/loading-spinner"

type AuthContextValue = {
  user: User | null
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: React.ReactNode
}
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);

  const { isFetching, data } = useUserDetailsQuery();

  const logout = useCallback(() => {
    
  }, [])

  const ctx = useMemo(() => ({
    user,
    logout,
  }), [user])

  useEffect(() => {
    if (!data) return

    setUser(data);
  }, [data])

  useEffect(() => {
    if (window.location.href.indexOf('#_=_') > 0) {
      window.location.href = window.location.href.replace(/#.*/, '');
    }
  })

  return (
    <AuthContext.Provider value={ctx}>
      {isFetching ? <LoadingSpinner /> : children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return ctx
}