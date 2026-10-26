import type { ApiClient } from '@vp/api-client';
import type {
  ContractBody,
  ContractResult,
  StartUpload,
  completeUpload,
  startUpload,
} from '@vp/api-contracts';
import { fromPromise, ignore, isOk } from '@vp/result';
import axios from 'axios';

export type UploadRequest = StartUpload & { file: File };

export type UploadProgressHandler = (percent: number) => void;

export type CompletedUpload = ContractResult<typeof completeUpload>;

type StartedUpload = ContractResult<typeof startUpload>;

type UploadedPart = NonNullable<NonNullable<ContractBody<typeof completeUpload>>['parts']>[number];

export interface UploadSession {
  signal?: AbortSignal;
  onStarted?: (uploadId: string) => void;
}

const PART_URL_BATCH = 100;

/**
 * The API never receives the bytes: it hands out presigned URLs, the browser
 * PUTs straight to object storage, and only then is the upload completed.
 */
export async function uploadVideo(
  api: ApiClient,
  { file, ...metadata }: UploadRequest,
  onProgress: UploadProgressHandler,
  { signal, onStarted }: UploadSession = {}
): Promise<CompletedUpload> {
  const started = await api.uploads.startUpload({ body: metadata, ...(signal && { signal }) });
  onStarted?.(started.uploadId);

  const completed = await fromPromise(
    async () => {
      const parts =
        started.strategy === 'single'
          ? await putWhole(started, file, onProgress, signal)
          : await putParts(api, started, file, onProgress, signal);

      return api.uploads.completeUpload({
        params: { uploadId: started.uploadId },
        body: parts.length > 0 ? { parts } : {},
      });
    },
    (cause) => cause
  );
  if (isOk(completed)) return completed.value;

  ignore(
    await fromPromise(
      () => api.uploads.abortUpload({ params: { uploadId: started.uploadId } }),
      (cause) => cause
    ),
    'the reconciler aborts what this request could not'
  );
  throw completed.error;
}

async function putWhole(
  { singleUrl, headers }: StartedUpload,
  file: File,
  onProgress: UploadProgressHandler,
  signal?: AbortSignal
): Promise<UploadedPart[]> {
  if (!singleUrl) throw new Error('The API did not issue an upload URL for this file');

  await axios.put(singleUrl, file, {
    headers,
    signal,
    onUploadProgress: ({ progress = 0 }) => onProgress(progress * 100),
  });
  return [];
}

async function partUrl(
  api: ApiClient,
  uploadId: string,
  urls: Map<number, string>,
  partNumber: number,
  signal?: AbortSignal
): Promise<string> {
  if (!urls.has(partNumber)) {
    const batch = await api.uploads.issueUploadParts({
      params: { uploadId },
      query: { from: partNumber, count: PART_URL_BATCH },
      ...(signal && { signal }),
    });
    for (const part of batch.parts) urls.set(part.partNumber, part.url);
  }

  const url = urls.get(partNumber);
  if (!url) throw new Error(`The API did not issue an upload URL for part ${partNumber}`);
  return url;
}

async function putParts(
  api: ApiClient,
  { uploadId, parts = [], partSizeBytes, partsExpected }: StartedUpload,
  file: File,
  onProgress: UploadProgressHandler,
  signal?: AbortSignal
): Promise<UploadedPart[]> {
  if (!partSizeBytes) {
    throw new Error('The API did not report a part size for this multipart upload');
  }

  const expected = partsExpected ?? parts.length;
  const urls = new Map(parts.map(({ partNumber, url }) => [partNumber, url]));
  const uploaded: UploadedPart[] = [];

  for (let partNumber = 1; partNumber <= expected; partNumber += 1) {
    const url = await partUrl(api, uploadId, urls, partNumber, signal);
    const start = (partNumber - 1) * partSizeBytes;
    const response = await axios.put(url, file.slice(start, start + partSizeBytes), { signal });

    uploaded.push({ partNumber, etag: String(response.headers['etag'] ?? '').replaceAll('"', '') });
    onProgress((partNumber / expected) * 100);
  }

  return uploaded;
}
