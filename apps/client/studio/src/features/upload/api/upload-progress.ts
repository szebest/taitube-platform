import { queryOptions, skipToken } from '@tanstack/react-query';

export interface UploadProgress {
  loaded: number;
  total: number;
}

export const uploadKeys = {
  all: ['uploads'] as const,
  progress: (id: string) => [...uploadKeys.all, 'progress', id] as const,
};

/** Filled by the upload's mutation as bytes move; nothing fetches it, so it never goes stale. */
export function uploadProgressQueryOptions(id: string) {
  return queryOptions<UploadProgress>({
    queryKey: uploadKeys.progress(id),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function percentOf({ loaded, total }: UploadProgress): number {
  return total === 0 ? 0 : (loaded / total) * 100;
}
