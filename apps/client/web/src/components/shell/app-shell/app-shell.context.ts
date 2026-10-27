import { createCompoundContext } from '@vp/ui';
import type { AppShellRailState, AppShellVariant } from './types';

export const [AppShellContext, useAppShell] = createCompoundContext<{
  variant: AppShellVariant;
  railState: AppShellRailState;
  setRailState: (next: AppShellRailState) => void;
  railId: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}>('AppShell');
