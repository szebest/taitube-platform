import { useQuery } from '@tanstack/react-query';
import type { OwnerChannel } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { actingChannelQueryOptions } from '#app/features/channel/api/acting-channel';
import { useActiveChannel } from '#app/features/team/hooks/use-active-channel';

/** The channel the page edits: the one the viewer switched to, not the one the session carries. */
export function useActingChannel(): OwnerChannel | undefined {
  const { channelId } = useActiveChannel();
  return useQuery(actingChannelQueryOptions(useApi(), channelId)).data;
}
