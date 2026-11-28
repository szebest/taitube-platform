import { keysetPaging } from '@kit/query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const pageKeys = {
  all: ['studio', 'page'] as const,
  channel: (channelId: string) => [...pageKeys.all, channelId] as const,
  draft: (channelId: string) => [...pageKeys.channel(channelId), 'draft'] as const,
  revisions: (channelId: string) => [...pageKeys.channel(channelId), 'revisions'] as const,
  schedules: (channelId: string) => [...pageKeys.channel(channelId), 'schedules'] as const,
};

export function pageDraftQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: pageKeys.draft(channelId),
    queryFn: () => api.channelPageStudio.getChannelPageDraft(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function pageRevisionsQueryOptions(api: ApiClient, channelId: string) {
  return infiniteQueryOptions({
    queryKey: pageKeys.revisions(channelId),
    queryFn: ({ pageParam }) =>
      api.channelPageStudio.listChannelPageRevisions({ query: { cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function pageSchedulesQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: pageKeys.schedules(channelId),
    queryFn: () => api.channelPageStudio.listChannelPageSchedules(),
  });
}
