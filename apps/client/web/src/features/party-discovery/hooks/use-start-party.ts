import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

function startPartyMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: () =>
      api.watchParties.createWatchParty({
        body: { visibility: 'public', preset: 'public', hostAs: 'user' },
      }),
    onSuccess: (_room, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: watchPartyKeys.all }),
  });
}

/** Starts a room from `/parties`: public, with the `public` preset, then takes its owner into it. */
export function useStartParty() {
  const api = useApi();
  const navigate = useNavigate();
  const start = useMutation(startPartyMutationOptions(api));

  return {
    ...start,
    start: () =>
      start.mutate(undefined, {
        onSuccess: ({ id }) => navigate({ to: '/parties/$roomId', params: { roomId: id } }),
      }),
  };
}
