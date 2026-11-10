import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { Account } from '@vp/api-contracts';
import { PermissionsProvider } from '@vp/permissions-react';
import { useAccount, useApi, viewerOf } from '@vp/queries';
import { type PropsWithChildren, useSyncExternalStore } from 'react';
import { membershipsQueryOptions } from '#app/features/team/api/team-queries';
import { type ActiveChannel, ActiveChannelContext } from '#app/hooks/use-active-channel';

const NONE: ActiveChannel['memberships'] = [];

function SignedInChannel({ account, children }: PropsWithChildren<{ account: Account }>) {
  const { actingChannel } = useRouter().options.context;
  const selected = useSyncExternalStore(
    actingChannel.subscribe,
    actingChannel.read,
    actingChannel.read
  );
  const memberships = useQuery(membershipsQueryOptions(useApi())).data?.items ?? NONE;

  const held = memberships.find(({ channelId }) => channelId === selected);
  const active: ActiveChannel = held
    ? { channelId: held.channelId, ownerId: held.ownerId, role: held.role, own: false, memberships }
    : {
        channelId: account.channel.id,
        ownerId: account.user.id,
        role: 'owner',
        own: true,
        memberships,
      };

  const viewer = viewerOf({ status: 'signed-in', account });
  const grants = Object.fromEntries(
    memberships.map(({ channelId, ownerId, role }) => [channelId, { ownerId, role }])
  );

  return (
    <ActiveChannelContext value={active}>
      <PermissionsProvider userContext={viewer && { ...viewer, memberships: grants }}>
        {children}
      </PermissionsProvider>
    </ActiveChannelContext>
  );
}

/** Tells everything below which channel the studio acts on, and the viewer's permissions on it; a guest has none. */
export function ActiveChannelProvider({ children }: PropsWithChildren) {
  const account = useAccount();

  return account ? <SignedInChannel account={account}>{children}</SignedInChannel> : children;
}
