import * as fs from 'node:fs';
import { fromPromise, isErr } from '@vp/result';

export interface UploadClientOptions {
  apiBaseUrl: string;
  token: string;
}

export interface InitUploadParams {
  filename: string;
  sizeBytes: number;
  contentType: string;
  title?: string;
  sha256?: string;
  strategy?: 'single' | 'multipart';
}

export interface PartInfo {
  partNumber: number;
  url: string;
  expiresAt: string;
}

export interface InitUploadResult {
  videoId: string;
  uploadId: string;
  strategy: 'single' | 'multipart';
  partSizeBytes?: number;
  partsExpected?: number;
  parts?: PartInfo[];
  singleUrl?: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface UploadedPartStatus {
  partNumber: number;
  etag: string;
  size: number;
}

export interface ResumeInfoResult {
  status: string;
  strategy: string;
  partSizeBytes?: number;
  partsExpected?: number;
  uploadedParts?: UploadedPartStatus[];
}

export class UploadAbortedError extends Error {
  constructor(message = 'Upload aborted before every part was sent') {
    super(message);
    this.name = 'UploadAbortedError';
  }
}

async function ensureOk(res: Response, operation: string): Promise<void> {
  if (res.ok) return;
  throw new Error(`${operation} failed (${res.status}): ${await res.text()}`);
}

export class UploadClient {
  private apiBaseUrl: string;
  private token: string;

  constructor(options: UploadClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '');
    this.token = options.token;
  }

  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });

    await ensureOk(res, 'initUpload');

    return (await res.json()) as InitUploadResult;
  }

  async getResumeInfo(uploadId: string): Promise<ResumeInfoResult> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads/${uploadId}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${this.token}`,
      },
    });

    await ensureOk(res, 'getResumeInfo');

    return (await res.json()) as ResumeInfoResult;
  }

  async getPartUrls(uploadId: string, from: number, count = 100): Promise<PartInfo[]> {
    const res = await fetch(
      `${this.apiBaseUrl}/v1/uploads/${uploadId}/parts?from=${from}&count=${count}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
        },
      }
    );

    await ensureOk(res, 'getPartUrls');

    const data = (await res.json()) as { parts: PartInfo[] };
    return data.parts;
  }

  async completeUpload(
    uploadId: string,
    parts?: Array<{ partNumber: number; etag: string }>
  ): Promise<{ videoId: string; status: string }> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads/${uploadId}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(parts ? { parts } : {}),
    });

    await ensureOk(res, 'completeUpload');

    return (await res.json()) as { videoId: string; status: string };
  }

  async abortUpload(uploadId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${this.token}`,
      },
    });

    await ensureOk(res, 'abortUpload');
  }

  async uploadFile(options: {
    filePath: string;
    contentType?: string;
    title?: string;
    strategy?: 'single' | 'multipart';
    concurrency?: number;
    existingUploadId?: string;
    signal?: AbortSignal;
    onProgress?: (completedParts: number, totalParts: number) => void;
  }): Promise<{ videoId: string; uploadId: string; status: string }> {
    const {
      filePath,
      contentType = 'video/mp4',
      title,
      strategy: requestedStrategy,
      concurrency = 4,
      existingUploadId,
      signal,
      onProgress,
    } = options;

    const stats = fs.statSync(filePath);
    const sizeBytes = stats.size;

    let uploadId: string;
    let videoId: string;
    let strategy: 'single' | 'multipart';
    let partSizeBytes: number;
    let partsExpected: number;
    const partUrlsMap = new Map<number, string>();
    const etagsByPart = new Map<number, string>();

    if (existingUploadId) {
      const resumeInfo = await this.getResumeInfo(existingUploadId);
      uploadId = existingUploadId;
      strategy = resumeInfo.strategy as 'single' | 'multipart';
      partSizeBytes = resumeInfo.partSizeBytes || 8 * 1024 * 1024;
      partsExpected = resumeInfo.partsExpected || 1;
      videoId = '';

      if (resumeInfo.uploadedParts) {
        for (const p of resumeInfo.uploadedParts) {
          etagsByPart.set(p.partNumber, p.etag);
        }
      }
    } else {
      const init = await this.initUpload({
        filename: filePath.split(/[\\/]/).pop() || 'upload.mp4',
        sizeBytes,
        contentType,
        title,
        strategy: requestedStrategy,
      });

      uploadId = init.uploadId;
      videoId = init.videoId;
      strategy = init.strategy;
      partSizeBytes = init.partSizeBytes || 8 * 1024 * 1024;
      partsExpected = init.partsExpected || 1;

      if (strategy === 'single') {
        if (!init.singleUrl) {
          throw new Error('API returned single strategy but no singleUrl');
        }
        const buffer = fs.readFileSync(filePath);
        const putRes = await fetch(init.singleUrl, {
          method: 'PUT',
          headers: init.headers || { 'content-type': contentType },
          body: buffer,
        });
        if (!putRes.ok) {
          throw new Error(`Single upload failed: ${putRes.statusText}`);
        }

        const comp = await this.completeUpload(uploadId);
        return { videoId: comp.videoId, uploadId, status: comp.status };
      }

      if (init.parts) {
        for (const p of init.parts) {
          partUrlsMap.set(p.partNumber, p.url);
        }
      }
    }

    const missingParts: number[] = [];
    for (let p = 1; p <= partsExpected; p++) {
      if (!etagsByPart.has(p)) {
        missingParts.push(p);
      }
    }

    let nextMissingIndex = 0;
    const fd = fs.openSync(filePath, 'r');

    const abortController = new AbortController();
    signal?.addEventListener('abort', () => abortController.abort(), { once: true });

    try {
      const uploadWorker = async (): Promise<void> => {
        while (nextMissingIndex < missingParts.length) {
          if (abortController.signal.aborted) break;

          const partNumber = missingParts[nextMissingIndex++];
          if (!partNumber) break;

          let partUrl = partUrlsMap.get(partNumber);
          if (!partUrl) {
            const freshParts = await this.getPartUrls(
              uploadId,
              partNumber,
              Math.min(100, partsExpected - partNumber + 1)
            );
            for (const fp of freshParts) {
              partUrlsMap.set(fp.partNumber, fp.url);
            }
            partUrl = partUrlsMap.get(partNumber);
            if (!partUrl) {
              throw new Error(`Failed to acquire presigned URL for part ${partNumber}`);
            }
          }

          if (abortController.signal.aborted) break;

          const startOffset = (partNumber - 1) * partSizeBytes;
          const currentPartSize = Math.min(partSizeBytes, sizeBytes - startOffset);
          const buffer = Buffer.alloc(currentPartSize);
          fs.readSync(fd, buffer, 0, currentPartSize, startOffset);

          const put = await fromPromise(
            () => fetch(partUrl, { method: 'PUT', body: buffer, signal: abortController.signal }),
            (cause) => cause
          );
          if (isErr(put)) {
            if (abortController.signal.aborted) return;
            throw put.error;
          }
          const putRes = put.value;

          if (!putRes.ok) {
            throw new Error(`Upload of part ${partNumber} failed with status ${putRes.status}`);
          }

          const etagRaw = putRes.headers.get('etag') || `"etag-${partNumber}"`;
          const etag = etagRaw.replace(/^"|"$/g, '');
          etagsByPart.set(partNumber, etag);

          if (onProgress) {
            onProgress(etagsByPart.size, partsExpected);
          }
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(concurrency, missingParts.length); i++) {
        workers.push(uploadWorker());
      }
      await Promise.all(workers);
    } finally {
      fs.closeSync(fd);
    }

    if (abortController.signal.aborted) {
      throw new UploadAbortedError(
        `Upload aborted after ${etagsByPart.size}/${partsExpected} parts`
      );
    }

    const sortedParts = Array.from(etagsByPart.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([partNumber, etag]) => ({ partNumber, etag }));

    const comp = await this.completeUpload(uploadId, sortedParts);
    return {
      videoId: comp.videoId || videoId,
      uploadId,
      status: comp.status,
    };
  }
}
