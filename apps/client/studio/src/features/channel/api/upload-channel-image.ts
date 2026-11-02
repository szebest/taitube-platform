import type { ApiClient } from '@vp/api-client';
import type { ChannelImageKind } from '@vp/validation';
import axios from 'axios';

/** The API never receives the bytes: it presigns a PUT, the browser sends the file, and the key goes in the channel save. */
export async function uploadChannelImage(
  api: ApiClient,
  kind: ChannelImageKind,
  file: File,
  signal?: AbortSignal
): Promise<string> {
  const issued = await api.me.issueChannelImageUpload({
    body: { kind, contentType: file.type, sizeBytes: file.size },
    ...(signal && { signal }),
  });
  await axios.put(issued.uploadUrl, file, { headers: issued.headers, signal });
  return issued.key;
}
