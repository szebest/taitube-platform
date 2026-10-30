import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type { CreatePickBody, UpdatePickBody } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

import { adminPickKeys } from '#app/features/admin/api/admin-picks';

const refetchPicks = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: adminPickKeys.all });

export function useCreatePick() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: CreatePickBody) => api.picks.createPick({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchPicks(client),
    })
  );
}

export function useUpdatePick() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ id, changes }: { id: string; changes: UpdatePickBody }) =>
        api.picks.updatePick({ params: { id }, body: changes }),
      onSettled: (_data, _error, _variables, _snapshot, { client }) => refetchPicks(client),
    })
  );
}

export function useCancelPick() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.picks.cancelPick({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchPicks(client),
    })
  );
}
