import {
  getWatchPartyPermissions,
  type UserContext,
  type WatchPartyAbility,
  type WatchPartyViewer,
} from '@vp/permissions';
import { createContext, type PropsWithChildren, useContext } from 'react';

export interface PartyPermissionsProviderProps extends PropsWithChildren {
  /** The signed-in viewer, or `null` for a guest or a Discord member. */
  userContext: UserContext | null;
  /** The viewer's seat in this room: what their roles hold and where they sit. */
  viewer: WatchPartyViewer;
}

const PartyPermissionsContext = createContext<WatchPartyAbility | undefined>(undefined);

/** The room-scoped ability of one party page; the principal-level `PermissionsProvider` stays above it. */
export function PartyPermissionsProvider({
  userContext,
  viewer,
  children,
}: PartyPermissionsProviderProps) {
  return (
    <PartyPermissionsContext value={getWatchPartyPermissions(userContext, viewer)}>
      {children}
    </PartyPermissionsContext>
  );
}

export function usePartyAbility(): WatchPartyAbility {
  const ability = useContext(PartyPermissionsContext);
  if (!ability) {
    throw new Error('usePartyAbility must be used within PartyPermissionsProvider');
  }
  return ability;
}
