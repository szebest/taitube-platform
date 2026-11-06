import { ONE_YEAR_S, readCookie, writeCookie } from '@vp/ui';
import { z } from 'zod';

const SidebarStateSchema = z.enum(['expanded', 'collapsed']);

export type SidebarState = z.infer<typeof SidebarStateSchema>;

const SIDEBAR_COOKIE = 'vp.sidebar';

export function requestSidebarState(): SidebarState {
  const stored = SidebarStateSchema.safeParse(readCookie(SIDEBAR_COOKIE));
  return stored.success ? stored.data : 'expanded';
}

export function saveSidebarState(state: SidebarState): void {
  writeCookie(SIDEBAR_COOKIE, state, { maxAge: ONE_YEAR_S });
}
