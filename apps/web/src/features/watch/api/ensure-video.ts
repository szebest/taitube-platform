import type { QueryClient } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import type { Video } from '@vp/api-contracts';
import { fromPromise, isOk } from '@vp/result';

import { videoQueryOptions } from './video-query-options';

const NOT_FOUND = 404;

export async function ensureVideo(queryClient: QueryClient, videoId: string): Promise<Video> {
  const loaded = await fromPromise(
    () => queryClient.ensureQueryData(videoQueryOptions(videoId)),
    (cause) => cause
  );
  if (isOk(loaded)) return loaded.value;
  if (loaded.error instanceof ApiError && loaded.error.status === NOT_FOUND) throw notFound();
  throw loaded.error;
}
