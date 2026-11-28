import type { ApiClient } from '@vp/api-client';
import type { ContractResult, completePlaylistCover } from '@vp/api-contracts';
import { coverCrop } from '../utils/cover-crop';

export interface CoverChoice {
  file: File;
  /** The file's decoded pixels, which the API reads again. */
  size: { width: number; height: number };
}

/**
 * The API never receives the bytes: it presigns a PUT, the browser sends the file, then the centred
 * 16:9 crop queues the job.
 */
export async function uploadPlaylistCover(
  api: ApiClient,
  playlistId: string,
  { file, size }: CoverChoice,
  onPrepared: (uploadId: string) => void
): Promise<ContractResult<typeof completePlaylistCover>> {
  const params = { id: playlistId };
  const prepared = await api.playlistCover.preparePlaylistCover({
    params,
    body: { contentType: file.type, sizeBytes: file.size },
  });
  onPrepared(prepared.uploadId);
  const sent = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: prepared.headers,
  });
  if (!sent.ok) {
    throw new Error(`The cover upload answered ${sent.status}`);
  }
  return api.playlistCover.completePlaylistCover({
    params,
    body: { uploadId: prepared.uploadId, ...size, crop: coverCrop(size) },
  });
}
