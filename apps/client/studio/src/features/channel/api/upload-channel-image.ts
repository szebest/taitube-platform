import type { ApiClient } from '@vp/api-client';
import type { QueuedChannelImage } from '@vp/api-contracts';
import type { ImageCrops } from '@vp/domain';
import type { ChannelImageKind } from '@vp/validation';
import axios from 'axios';

interface ChannelImageUpload {
  kind: ChannelImageKind;
  file: File;
  /** The file's decoded pixels, which the API reads again. */
  size: { width: number; height: number };
  crops: ImageCrops;
}

/** The API never receives the bytes: it presigns a PUT, the browser sends the file, then the crops queue the job. */
export async function uploadChannelImage(
  api: ApiClient,
  { kind, file, size, crops }: ChannelImageUpload,
  onPrepared: (uploadId: string) => void,
  signal?: AbortSignal
): Promise<QueuedChannelImage> {
  const prepared = await api.channelIdentity.prepareChannelImage({
    params: { kind },
    body: { contentType: file.type, sizeBytes: file.size },
    ...(signal && { signal }),
  });
  onPrepared(prepared.uploadId);
  await axios.put(prepared.uploadUrl, file, { headers: prepared.headers, signal });
  return api.channelIdentity.completeChannelImage({
    params: { kind },
    body: {
      uploadId: prepared.uploadId,
      ...size,
      ...(crops.kind === 'avatar' ? { crop: crops.crop } : { crops: crops.crops }),
    },
    ...(signal && { signal }),
  });
}
