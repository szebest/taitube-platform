import { useQuery } from '@tanstack/react-query';
import { PermissionsProvider } from '@vp/permissions-react';
import { membershipsQueryOptions, useAccount, useApi, viewerOf } from '@vp/queries';
import type { PropsWithChildren } from 'react';

/** Adds the channels the viewer works on to what the session grants, so a moderator gets the moderation actions on a channel that is not their own. */
export function ChannelPermissions({ children }: PropsWithChildren) {
  const account = useAccount();
  const { data } = useQuery({
    ...membershipsQueryOptions(useApi()),
    enabled: account !== undefined,
  });

  const viewer = account ? viewerOf({ status: 'signed-in', account }) : null;
  const memberships = Object.fromEntries(
    (data?.items ?? []).map(({ channelId, ownerId, role }) => [channelId, { ownerId, role }])
  );

  return (
    <PermissionsProvider userContext={viewer && { ...viewer, memberships }}>
      {children}
    </PermissionsProvider>
  );
}
