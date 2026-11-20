import type { ChannelMembershipView } from '@vp/api-contracts';
import { useAccount } from '@vp/queries';
import { type PropsWithChildren, createContext, useContext, useState } from 'react';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { LeaveTeamDialog } from '../leave-team-dialog/leave-team-dialog';
import { LeaveTeamItem } from '../leave-team-item/leave-team-item';

type Leaving = { held: ChannelMembershipView; leave: () => void } | undefined;

const LeavingContext = createContext<Leaving>(undefined);

/**
 * Holds the leave-team confirmation outside the account menu, so it outlives the menu closing; the
 * membership is the one the studio acts on, none on the viewer's own channel.
 */
function HeldTeam({ children }: PropsWithChildren) {
  const { channelId, own, memberships } = useActiveChannel();
  const [leaving, setLeaving] = useState(false);
  const held = own ? undefined : memberships.find((item) => item.channelId === channelId);

  return (
    <LeavingContext value={held && { held, leave: () => setLeaving(true) }}>
      {children}
      {leaving && held && <LeaveTeamDialog membership={held} onClose={() => setLeaving(false)} />}
    </LeavingContext>
  );
}

/** The account menu's entry that opens the confirmation. */
function LeaveTeamMenuItem() {
  const leaving = useContext(LeavingContext);

  return leaving ? <LeaveTeamItem membership={leaving.held} onLeave={leaving.leave} /> : null;
}

function LeaveTeamRoot({ children }: PropsWithChildren) {
  return useAccount() ? <HeldTeam>{children}</HeldTeam> : children;
}

export const LeaveTeam = { Root: LeaveTeamRoot, MenuItem: LeaveTeamMenuItem };
