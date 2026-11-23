import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { VideoGenerationsView } from '@vp/api-contracts';
import { IN_FLIGHT_GENERATIONS } from '@vp/domain-rules';
import { videoKeys } from '@vp/queries';

const videoPipelineKeys = {
  generations: (videoId: string) => [...videoKeys.detail(videoId), 'generations'] as const,
  clipSuggestions: (videoId: string) => [...videoKeys.detail(videoId), 'clip-suggestions'] as const,
};

/** Polled while a replacement or an edit is in flight; the event stream also refreshes it when one lands. */
const IN_FLIGHT_POLL_MS = 5_000;

/** A replacement or an edit is uploading or rendering, so nothing new can start. */
export const generationInFlight = (view: VideoGenerationsView | undefined): boolean =>
  view?.items.some(({ status }) => IN_FLIGHT_GENERATIONS.includes(status)) ?? false;

export function generationsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoPipelineKeys.generations(videoId),
    queryFn: () => api.videoPipeline.listVideoGenerations({ params: { id: videoId } }),
    refetchInterval: (query) => (generationInFlight(query.state.data) ? IN_FLIGHT_POLL_MS : false),
  });
}

export function clipSuggestionsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoPipelineKeys.clipSuggestions(videoId),
    queryFn: () => api.videoPipeline.getClipSuggestions({ params: { id: videoId } }),
  });
}
