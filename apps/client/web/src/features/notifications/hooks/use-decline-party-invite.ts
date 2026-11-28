import { useMutation } from '@tanstack/react-query';
import { useApi, useFailureToast } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { useMarkRead } from './use-mark-read';

interface Declined {
  inviteId: string;
  notificationId: string;
}

/** Declines an invite and marks its notification read at once; nobody is told. */
export function useDeclinePartyInvite() {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const markRead = useMarkRead();

  return useMutation({
    mutationFn: ({ inviteId }: Declined) =>
      api.watchPartyInvites.declineWatchPartyInvite({ params: { inviteId } }),
    onMutate: ({ notificationId }) => markRead.mutate({ scope: 'ids', ids: [notificationId] }),
    onError: (error) => showFailure(tOr('party.inviteDeclineFailed', {}, ''), error),
  });
}
