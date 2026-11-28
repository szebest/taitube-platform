import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelPageDraftView } from '@vp/api-contracts';
import type { ChannelLayout } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { pageKeys } from '../api/page-queries';

export interface DraftSave {
  document: ChannelLayout;
  version: number;
}

export interface PagePublish {
  version: number;
  note?: string | null;
}

export interface PageSchedule {
  publishAt: string;
  source: 'draft' | 'published';
}

const refetch = (client: QueryClient, key: readonly unknown[]) =>
  client.invalidateQueries({ queryKey: key });

export function saveDraftMutationOptions(api: ApiClient, channelId: string) {
  return mutationOptions({
    mutationFn: (body: DraftSave) => api.channelPageStudio.saveChannelPageDraft({ body }),
    onSuccess: (draft: ChannelPageDraftView, _body, _snapshot, { client }) =>
      client.setQueryData(pageKeys.draft(channelId), draft),
  });
}

export function useSaveDraft() {
  return useMutation(saveDraftMutationOptions(useApi(), useActiveChannel().channelId));
}

export function usePublishPage() {
  const api = useApi();
  const { channelId } = useActiveChannel();

  return useMutation(
    mutationOptions({
      mutationFn: (body: PagePublish) => api.channelPageStudio.publishChannelPage({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) =>
        refetch(client, pageKeys.channel(channelId)),
    })
  );
}

export function useSchedulePage() {
  const api = useApi();
  const { channelId } = useActiveChannel();

  return useMutation(
    mutationOptions({
      mutationFn: (body: PageSchedule) => api.channelPageStudio.scheduleChannelPage({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) =>
        refetch(client, pageKeys.schedules(channelId)),
    })
  );
}

export function useCancelSchedule() {
  const api = useApi();
  const { channelId } = useActiveChannel();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) =>
        api.channelPageStudio.cancelChannelPageSchedule({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) =>
        refetch(client, pageKeys.schedules(channelId)),
    })
  );
}

export function useRestoreRevision() {
  const api = useApi();
  const { channelId } = useActiveChannel();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) =>
        api.channelPageStudio.restoreChannelPageRevision({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) =>
        refetch(client, pageKeys.channel(channelId)),
    })
  );
}
