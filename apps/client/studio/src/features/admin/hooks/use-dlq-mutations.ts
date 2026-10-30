import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { adminDlqKeys } from '#app/features/admin/api/admin-dlq';

const refetchDlq = (client: QueryClient) => client.invalidateQueries({ queryKey: adminDlqKeys.all });

export function useReplayDlqEntry() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.adminDlq.replayDlqEntry({ params: { id }, body: {} }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchDlq(client),
    })
  );
}

export function useDiscardDlqEntry() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.adminDlq.discardDlqEntry({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchDlq(client),
    })
  );
}
