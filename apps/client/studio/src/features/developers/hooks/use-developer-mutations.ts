import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type {
  ContractBody,
  createApiToken,
  createChannelExport,
  createWebhook,
} from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { developerKeys } from '#app/features/developers/api/developer-queries';

export type TokenDraft = ContractBody<typeof createApiToken>;
export type WebhookDraft = ContractBody<typeof createWebhook>;
export type ExportDraft = ContractBody<typeof createChannelExport>;

const refetch = (key: readonly string[]) => (client: QueryClient) =>
  client.invalidateQueries({ queryKey: key });
const refetchTokens = refetch(developerKeys.tokens());
const refetchWebhooks = refetch(developerKeys.webhooks());
const refetchExports = refetch(developerKeys.exports());

export function useCreateToken() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: TokenDraft) => api.apiTokens.createApiToken({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchTokens(client),
    })
  );
}

export function useRevokeToken() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.apiTokens.revokeApiToken({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchTokens(client),
    })
  );
}

export function useCreateWebhook() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: WebhookDraft) => api.webhooks.createWebhook({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchWebhooks(client),
    })
  );
}

export function useDeleteWebhook() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.webhooks.deleteWebhook({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchWebhooks(client),
    })
  );
}

export function useTestWebhook() {
  const api = useApi();

  return useMutation({
    mutationFn: (id: string) => api.webhooks.testWebhook({ params: { id } }),
  });
}

export function useRequestExport() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: ExportDraft) => api.channelExports.createChannelExport({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchExports(client),
    })
  );
}

export function useDeleteExport() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.channelExports.deleteChannelExport({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchExports(client),
    })
  );
}

/** The export with a fresh presigned address for its file, asked for only when the creator downloads it. */
export function useExportDownload() {
  const api = useApi();

  return useMutation({
    mutationFn: (id: string) => api.channelExports.getChannelExport({ params: { id } }),
  });
}
