import { fromPromise, isOk } from '@kit/result';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Channel } from '@vp/api-contracts';
import { canUpdateChannel } from '@vp/permissions';
import { membershipGrantsOf, membershipsQueryOptions, type Session, viewerOf } from '@vp/queries';

export interface PreviewContext {
  queryClient: QueryClient;
  api: ApiClient;
  auth: Session;
}

/**
 * Whether this session may see the draft of the channel page: it acts on this channel and its
 * ability lets it edit the channel. `preview` and `as` ask for nothing more than that; the API
 * answers the draft to such a caller only.
 */
export async function canPreviewDraft(
  { queryClient, api, auth }: PreviewContext,
  channel: Pick<Channel, 'id' | 'userId'>
): Promise<boolean> {
  const viewer = viewerOf(auth);
  if (auth.status !== 'signed-in' || viewer === null) return false;
  if ((auth.actingChannelId ?? auth.account.channel.id) !== channel.id) return false;

  const memberships = await fromPromise(
    () => queryClient.fetchQuery(membershipsQueryOptions(api)),
    (cause) => cause
  );
  if (!isOk(memberships)) return false;

  return canUpdateChannel({
    user: { ...viewer, memberships: membershipGrantsOf(memberships.value.items) },
    channel: { id: channel.id, userId: channel.userId, ownerId: channel.userId },
  });
}
