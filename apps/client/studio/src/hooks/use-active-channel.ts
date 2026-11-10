import type { ChannelMembershipView } from '@vp/api-contracts';
import type { ActingRole } from '@vp/domain';
import { createContext, useContext } from 'react';

export interface ActiveChannel {
  channelId: string;
  /** The channel owner's user id, which the permission rules key their conditions on. */
  ownerId: string;
  role: ActingRole;
  /** The viewer's own channel, which they own; otherwise a team they work on. */
  own: boolean;
  /** The channels the viewer works on besides their own. */
  memberships: readonly ChannelMembershipView[];
}

export const ActiveChannelContext = createContext<ActiveChannel | undefined>(undefined);

/** The channel every studio route acts on, and the role the viewer holds there. */
export function useActiveChannel(): ActiveChannel {
  const active = useContext(ActiveChannelContext);
  if (!active) {
    throw new Error('useActiveChannel must be used within ActiveChannelProvider');
  }
  return active;
}
