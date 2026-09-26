import axios from 'axios';
import type { ApiClient } from '@vp/api-client';
import type { PresignedPart, StartUpload } from '@vp/api-contracts';

export type UploadRequest = StartUpload & { file: File };

export type UploadProgressHandler = (percent: number) => void;

export interface CompletedUpload {
  videoId: string;
  status: string;
}

/**
 * The API never receives the bytes: it hands out presigned URLs, the browser
 * PUTs straight to object storage, and only then is the upload completed.
 */
export async function uploadVideo(
  client: ApiClient,
  { file, ...metadata }: UploadRequest,
  onProgress: UploadProgressHandler = () => {}
): Promise<CompletedUpload> {
  const started = await client.uploads.startUpload({ body: metadata });

  const parts =
    started.strategy === 'single'
      ? await putWhole(started.singleUrl, started.headers, file, onProgress)
      : await putParts(client, started.uploadId, started.parts ?? [], started, file, onProgress);

  return client.uploads.completeUpload({
    params: { uploadId: started.uploadId },
    body: parts.length > 0 ? { parts } : {},
  });
}

async function putWhole(
  url: string | undefined,
  headers: Record<string, string> | undefined,
  file: File,
  onProgress: UploadProgressHandler
): Promise<{ partNumber: number; etag: string }[]> {
  if (!url) {
    throw new Error('The API did not issue an upload URL for this file');
  }

  await axios.put(url, file, {
    headers,
    onUploadProgress: (progress) => onProgress((progress.progress ?? 0) * 100),
  });

  return [];
}

async function putParts(
  client: ApiClient,
  uploadId: string,
  issued: PresignedPart[],
  started: { partSizeBytes?: number; partsExpected?: number },
  file: File,
  onProgress: UploadProgressHandler
): Promise<{ partNumber: number; etag: string }[]> {
  const partSize = started.partSizeBytes;
  const expected = started.partsExpected ?? issued.length;

  if (!partSize) {
    throw new Error('The API did not report a part size for this multipart upload');
  }

  const urls = new Map(issued.map((part) => [part.partNumber, part.url]));
  const uploaded: { partNumber: number; etag: string }[] = [];

  for (let partNumber = 1; partNumber <= expected; partNumber += 1) {
    if (!urls.has(partNumber)) {
      const batch = await client.uploads.issueUploadParts({
        params: { uploadId },
        query: { from: partNumber, count: 100 },
      });
      for (const part of batch.parts) {
        urls.set(part.partNumber, part.url);
      }
    }

    const url = urls.get(partNumber);
    if (!url) {
      throw new Error(`The API did not issue an upload URL for part ${partNumber}`);
    }

    const start = (partNumber - 1) * partSize;
    const response = await axios.put(url, file.slice(start, start + partSize));
    const etag = String(response.headers['etag'] ?? '').replace(/"/g, '');

    uploaded.push({ partNumber, etag });
    onProgress((partNumber / expected) * 100);
  }

  return uploaded;
}
