import { type PropsWithChildren, createContext, useContext, useMemo, useState } from "react"
import { z } from "zod";

import { useStoredState } from "src/hooks/use-stored-state";

type SidebarContextValue = {
	collapsed: boolean;
	isBelowBreakpoint?: boolean;
	toggle: VoidFunction;
	close: VoidFunction;
	breakpointChanged: (_: boolean) => void;
}

const Collapsed = z.boolean();

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export type SidebarProviderProps = PropsWithChildren;

export const SidebarProvider = ({ children }: SidebarProviderProps) => {
	const [collapsed, setCollapsed] = useStoredState('SIDEBAR', Collapsed, false);
	const [isBelowBreakpoint, setIsBelowBreakpoint] = useState<boolean | undefined>(undefined);

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
		throw new Error('useSidebar must be used within SidebarProvider')
	}
	return ctx
}