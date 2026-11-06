import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';

export const videoKeys = {
  all: ['videos'] as const,
  detail: (videoId: string) => [...videoKeys.all, 'detail', videoId] as const,
  mine: () => [...videoKeys.all, 'mine'] as const,
  retention: (videoId: string) => [...videoKeys.all, 'retention', videoId] as const,
  captions: (videoId: string) => [...videoKeys.all, 'captions', videoId] as const,
};

export function videoQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoKeys.detail(videoId),
    queryFn: () => api.videos.getVideo({ params: { id: videoId } }),
  });
}

export function videoRetentionQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoKeys.retention(videoId),
    queryFn: () => api.analytics.getVideoRetention({ params: { id: videoId } }),
  });
}

export function captionsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoKeys.captions(videoId),
    queryFn: () => api.captions.listCaptions({ params: { id: videoId } }),
  });
}

export function transcriptQueryOptions(
  api: ApiClient,
  videoId: string,
  language: string | null,
  search = ''
) {
  return queryOptions({
    queryKey: [...videoKeys.captions(videoId), 'transcript', language, search] as const,
    queryFn: () =>
      api.captions.getTranscript({
        params: { id: videoId },
        query: { lang: language ?? undefined, q: search || undefined },
      }),
  });
}

export function myVideosQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: videoKeys.mine(),
    queryFn: ({ pageParam }) =>
      api.videos.listVideos({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}
