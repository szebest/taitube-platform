import { useQuery } from '@tanstack/react-query';
import {
  myWatchPartiesQueryOptions,
  useAccount,
  useApi,
  watchPartyPreviewQueryOptions,
} from '@vp/queries';

/** The open party the viewer sits in or owns where they hold `queue.add`, once both are known; `undefined` until then or when there is none. */
export function useQueueableParty(): { id: string; name: string } | undefined {
  const api = useApi();
  const account = useAccount();
  const { data: mine } = useQuery({
    ...myWatchPartiesQueryOptions(api),
    enabled: account !== undefined,
  });
  const room = [...(mine?.owning ?? []), ...(mine?.joined ?? [])].find(
    ({ status }) => status === 'open'
  );
  const { data: preview } = useQuery({
    ...watchPartyPreviewQueryOptions(api, room?.id ?? ''),
    enabled: room !== undefined,
  });

  return room && preview?.viewer.permissions.includes('queue.add')
    ? { id: room.id, name: room.name }
    : undefined;
}
