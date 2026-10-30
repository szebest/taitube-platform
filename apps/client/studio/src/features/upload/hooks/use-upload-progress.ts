import { useQuery } from '@tanstack/react-query';

import { type UploadProgress, uploadProgressQueryOptions } from '../api/upload-progress';

/** The bytes the upload `id` has sent so far, from the query cache; `undefined` before its first report. */
export function useUploadProgress(id: string): UploadProgress | undefined {
  return useQuery(uploadProgressQueryOptions(id)).data;
}
