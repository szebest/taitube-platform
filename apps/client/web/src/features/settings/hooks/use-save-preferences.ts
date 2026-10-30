import type { QueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { type ApiClient, ApiError } from '@vp/api-client';
import type { PreferencesView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { fromPromise, isOk } from '@vp/result';

import { restoreQueryData } from '#app/integrations/query/restore-query-data';

import { applyChange, type PreferencesChange } from '../api/preferences-change';
import { preferencesQueryOptions } from '../api/preferences-queries';

const CONFLICT = 409;

async function sendChange(api: ApiClient, client: QueryClient, change: PreferencesChange) {
  const { queryKey } = preferencesQueryOptions(api);
  const attempt = () =>
    api.preferences.updatePreferences({
      body: { ...change, version: client.getQueryData(queryKey)?.version ?? 0 },
    });

  const first = await fromPromise(attempt, (cause) => cause);
  if (isOk(first)) return first.value;
  if (!(first.error instanceof ApiError && first.error.status === CONFLICT)) throw first.error;

  await client.fetchQuery({ ...preferencesQueryOptions(api), staleTime: 0 });
  return attempt();
}

export type SavePreferencesCallbacks = Readonly<{
  onSaved: (view: PreferencesView, change: PreferencesChange) => void;
  onFailed: (change: PreferencesChange) => void;
}>;

/**
 * One change of the viewer's account preferences, applied to the cached document at once and sent
 * as `PATCH /v1/me/preferences`. A version conflict refetches the document and sends the change
 * again on it; one at a time, so each change is based on the document the last one left.
 */
export function useSavePreferences({ onSaved, onFailed }: SavePreferencesCallbacks) {
  const api = useApi();
  const { queryKey } = preferencesQueryOptions(api);

  return useMutation({
    scope: { id: 'preferences' },
    mutationFn: ({ change }: { change: PreferencesChange }, { client }) =>
      sendChange(api, client, change),
    onMutate: async ({ change }, { client }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      if (previous) client.setQueryData(queryKey, applyChange(previous, change));
      return { previous };
    },
    onSuccess: (view, { change }, _snapshot, { client }) => {
      client.setQueryData(queryKey, view);
      onSaved(view, change);
    },
    onError: (_error, { change }, snapshot, { client }) => {
      restoreQueryData(client, queryKey, snapshot?.previous);
      onFailed(change);
    },
  });
}
