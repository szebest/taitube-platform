import type { ApiClient } from '@vp/api-client';
import type {
  ContractBody,
  ContractResult,
  completeUpload,
  StartUpload,
  startUpload,
} from '@vp/api-contracts';
import { type Err, fromPromise, ignore, isErr, isOk } from '@vp/result';
import axios from 'axios';

import type { UploadProgress } from './upload-progress';

export type UploadRequest = StartUpload & { file: File };

export type UploadProgressHandler = (progress: UploadProgress) => void;

export type CompletedUpload = ContractResult<typeof completeUpload>;

type StartedUpload = ContractResult<typeof startUpload>;

type UploadedPart = NonNullable<NonNullable<ContractBody<typeof completeUpload>>['parts']>[number];

export interface UploadSession {
  signal?: AbortSignal;
  onStarted?: (uploadId: string) => void;
  onCompleting?: () => void;
}

const PART_URL_BATCH = 100;
const PART_CONCURRENCY = 4;

/**
 * The API never receives the bytes: it hands out presigned URLs, the browser
 * PUTs straight to object storage, and only then is the upload completed.
 */
export async function uploadVideo(
  api: ApiClient,
  { file, ...metadata }: UploadRequest,
  onProgress: UploadProgressHandler,
  { signal, onStarted, onCompleting }: UploadSession = {}
): Promise<CompletedUpload> {
  const started = await api.uploads.startUpload({ body: metadata, ...(signal && { signal }) });
  onStarted?.(started.uploadId);

  const transferred = await fromPromise(
    () =>
      started.strategy === 'single'
        ? putWhole(started, file, onProgress, signal)
        : putParts(api, started, file, onProgress, signal),
    (cause) => cause
  );
  if (!isOk(transferred)) {
    ignore(
      await fromPromise(
        () => api.uploads.abortUpload({ params: { uploadId: started.uploadId } }),
        (cause) => cause
      ),
      'the reconciler aborts what this request could not'
    );
    throw transferred.error;
  }

  onCompleting?.();
  return api.uploads.completeUpload({
    params: { uploadId: started.uploadId },
    body: transferred.value.length > 0 ? { parts: transferred.value } : {},
  });
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
    onUploadProgress: ({ loaded, total = file.size }) => onProgress({ loaded, total }),
  });
  return [];
}

interface PartUrls {
  issued: Map<number, string>;
  requested: Map<number, Promise<void>>;
}

async function partUrl(
  api: ApiClient,
  uploadId: string,
  { issued, requested }: PartUrls,
  partNumber: number,
  signal: AbortSignal
): Promise<string> {
  if (!issued.has(partNumber)) {
    let batch = requested.get(partNumber);
    if (!batch) {
      batch = api.uploads
        .issueUploadParts({
          params: { uploadId },
          query: { from: partNumber, count: PART_URL_BATCH },
          signal,
        })
        .then((issuedBatch) => {
          for (const part of issuedBatch.parts) issued.set(part.partNumber, part.url);
        });
      for (let offset = 0; offset < PART_URL_BATCH; offset += 1) {
        requested.set(partNumber + offset, batch);
      }
    }
    await batch;
  }

  const url = issued.get(partNumber);
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
  const urls: PartUrls = {
    issued: new Map(parts.map(({ partNumber, url }) => [partNumber, url])),
    requested: new Map(),
  };
  const uploaded: UploadedPart[] = [];
  const loadedByPart = new Map<number, number>();
  const failure = new AbortController();
  const stop = signal ? AbortSignal.any([signal, failure.signal]) : failure.signal;
  let reported = 0;
  let nextPart = 1;

  const reportLoaded = (partNumber: number, loaded: number) => {
    loadedByPart.set(partNumber, loaded);
    const loadedTotal = [...loadedByPart.values()].reduce((sum, bytes) => sum + bytes, 0);
    reported = Math.max(reported, loadedTotal);
    onProgress({ loaded: reported, total: file.size });
  };

  const worker = async () => {
    while (nextPart <= expected && !stop.aborted) {
      const partNumber = nextPart;
      nextPart += 1;

      const url = await partUrl(api, uploadId, urls, partNumber, stop);
      const start = (partNumber - 1) * partSizeBytes;
      const body = file.slice(start, start + partSizeBytes);
      const response = await axios.put(url, body, {
        signal: stop,
        onUploadProgress: ({ loaded }) => reportLoaded(partNumber, loaded),
      });

      reportLoaded(partNumber, body.size);
      uploaded.push({
        partNumber,
        etag: String(response.headers['etag'] ?? '').replaceAll('"', ''),
      });
    }
  };

  let firstFailure: Err<unknown> | undefined;
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, expected) }, async () => {
      const outcome = await fromPromise(worker(), (cause) => cause);
      if (isErr(outcome)) {
        firstFailure ??= outcome;
        failure.abort();
      }
    })
  );
  if (firstFailure) throw firstFailure.error;
  stop.throwIfAborted();

  return uploaded.sort((a, b) => a.partNumber - b.partNumber);
}
