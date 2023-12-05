import { useLocalStorage } from "@uidotdev/usehooks";
import { createContext, useContext, useMemo, useState } from "react"

type SidebarContextValue = {
  collapsed: boolean;
  isBelowBreakpoint: boolean;
  toggle: () => void;
  close: () => void;
  breakpointChanged: (_: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export type SidebarProviderProps = {
  children: React.ReactNode
}
export const SidebarProvider = ({ children }: SidebarProviderProps) => {
  const [collapsed, setCollapsed] = useLocalStorage('SIDEBAR', false);
  const [isBelowBreakpoint, setIsBelowBreakpoint] = useState(false);

  const ctx = useMemo(() => ({
    collapsed,
    isBelowBreakpoint,
    toggle: () => setCollapsed(prev => !prev),
    close: () => isBelowBreakpoint && setCollapsed(true),
    breakpointChanged: (value: boolean) => setIsBelowBreakpoint(value)
  }), [collapsed, isBelowBreakpoint, setCollapsed]);

  return (
    <SidebarContext.Provider value={ctx}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used within AuthProvider')
  }
  return ctx
}