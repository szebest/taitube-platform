import type {
  ContractBody,
  ContractResult,
  StartUpload,
  completeUpload,
  startUpload,
} from '@vp/api-contracts';
import axios from 'axios';

import { apiClient } from '#app/integrations/api/api-client';

export type UploadRequest = StartUpload & { file: File };

export type UploadProgressHandler = (percent: number) => void;

export type CompletedUpload = ContractResult<typeof completeUpload>;

type StartedUpload = ContractResult<typeof startUpload>;

type UploadedPart = NonNullable<NonNullable<ContractBody<typeof completeUpload>>['parts']>[number];

const PART_URL_BATCH = 100;

/**
 * The API never receives the bytes: it hands out presigned URLs, the browser
 * PUTs straight to object storage, and only then is the upload completed.
 */
export async function uploadVideo(
  { file, ...metadata }: UploadRequest,
  onProgress: UploadProgressHandler
): Promise<CompletedUpload> {
  const started = await apiClient.uploads.startUpload({ body: metadata });
  const parts =
    started.strategy === 'single'
      ? await putWhole(started, file, onProgress)
      : await putParts(started, file, onProgress);

  return apiClient.uploads.completeUpload({
    params: { uploadId: started.uploadId },
    body: parts.length > 0 ? { parts } : {},
  });
}

async function putWhole(
  { singleUrl, headers }: StartedUpload,
  file: File,
  onProgress: UploadProgressHandler
): Promise<UploadedPart[]> {
  if (!singleUrl) throw new Error('The API did not issue an upload URL for this file');

  await axios.put(singleUrl, file, {
    headers,
    onUploadProgress: ({ progress = 0 }) => onProgress(progress * 100),
  });
  return [];
}

async function partUrl(
  uploadId: string,
  urls: Map<number, string>,
  partNumber: number
): Promise<string> {
  if (!urls.has(partNumber)) {
    const batch = await apiClient.uploads.issueUploadParts({
      params: { uploadId },
      query: { from: partNumber, count: PART_URL_BATCH },
    });
    for (const part of batch.parts) urls.set(part.partNumber, part.url);
  }

  const url = urls.get(partNumber);
  if (!url) throw new Error(`The API did not issue an upload URL for part ${partNumber}`);
  return url;
}

async function putParts(
  { uploadId, parts = [], partSizeBytes, partsExpected }: StartedUpload,
  file: File,
  onProgress: UploadProgressHandler
): Promise<UploadedPart[]> {
  if (!partSizeBytes) {
    throw new Error('The API did not report a part size for this multipart upload');
  }

  const expected = partsExpected ?? parts.length;
  const urls = new Map(parts.map(({ partNumber, url }) => [partNumber, url]));
  const uploaded: UploadedPart[] = [];

  for (let partNumber = 1; partNumber <= expected; partNumber += 1) {
    const url = await partUrl(uploadId, urls, partNumber);
    const start = (partNumber - 1) * partSizeBytes;
    const response = await axios.put(url, file.slice(start, start + partSizeBytes));

    uploaded.push({ partNumber, etag: String(response.headers['etag'] ?? '').replaceAll('"', '') });
    onProgress((partNumber / expected) * 100);
  }

  return uploaded;
}
