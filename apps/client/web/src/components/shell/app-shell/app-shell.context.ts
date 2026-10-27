import { createCompoundContext } from '@vp/ui';
import { createContext } from 'react';
import type { AppShellRailState, AppShellVariant } from './types';

export const [AppShellContext, useAppShell] = createCompoundContext<{
  variant: AppShellVariant;
  railState: AppShellRailState;
  setRailState: (next: AppShellRailState) => void;
  railId: string;
  drawerId: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  railOverlay: boolean;
  setRailOverlay: (open: boolean) => void;
}>('AppShell');

export const RailLabelsShown = createContext(true);
