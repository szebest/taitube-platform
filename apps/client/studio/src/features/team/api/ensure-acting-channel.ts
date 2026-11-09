import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { type ActingChannelStore, SESSION_KEY, type Session } from '@vp/queries';
import { membershipsQueryOptions, teamKeys } from './team-queries';

interface EnsureContext {
  auth: Session;
  api: ApiClient;
  queryClient: QueryClient;
  actingChannel: ActingChannelStore;
}

const KEPT: readonly (readonly string[])[] = [SESSION_KEY, teamKeys.memberships()];

/** Everything the cache holds about the channel being left; the session and the viewer's channels stay. */
export function forgetChannelData(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: ({ queryKey }) =>
      !KEPT.some((kept) => kept.every((part, i) => queryKey[i] === part)),
  });
}

/**
 * `_authed`'s `beforeLoad`: loads the channels the viewer works on, and puts a viewer whose
 * membership ended back on their own channel, so no call names a channel the API would refuse.
 */
export async function ensureActingChannel({
  auth,
  api,
  queryClient,
  actingChannel,
}: EnsureContext): Promise<void> {
  if (auth.status !== 'signed-in') return;

  const selected = actingChannel.read();
  const options = membershipsQueryOptions(api);
  if (selected === undefined) {
    await queryClient.ensureQueryData(options);
    return;
  }

  const { items } = await queryClient.fetchQuery({ ...options, staleTime: 0 });
  if (items.some(({ channelId }) => channelId === selected)) return;

  actingChannel.select(undefined);
  forgetChannelData(queryClient);
}
