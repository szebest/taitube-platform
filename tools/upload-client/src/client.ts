import * as fs from 'node:fs';

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

export class ClientCrashedError extends Error {
  constructor(message = 'Client simulated crash at threshold') {
    super(message);
    this.name = 'ClientCrashedError';
  }
}

export class UploadClient {
  private apiBaseUrl: string;
  private token: string;

  constructor(options: UploadClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '');
    this.token = options.token;
  }

  /**
   * Initializes upload via POST /v1/uploads (SDD §3.1, §6.1, AC 17).
   */
  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`initUpload failed (${res.status}): ${err}`);
    }

    return (await res.json()) as InitUploadResult;
  }

  /**
   * Fetches resume info via GET /v1/uploads/:uploadId (SDD §3.1, §6.1, AC 18).
   */
  async getResumeInfo(uploadId: string): Promise<ResumeInfoResult> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads/${uploadId}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${this.token}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`getResumeInfo failed (${res.status}): ${err}`);
    }

    return (await res.json()) as ResumeInfoResult;
  }

  /**
   * Requests a fresh batch of presigned part URLs via POST /v1/uploads/:uploadId/parts (AC 17).
   */
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

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`getPartUrls failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { parts: PartInfo[] };
    return data.parts;
  }

  /**
   * Completes the upload via POST /v1/uploads/:uploadId/complete (AC 18, AC 19).
   */
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

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`completeUpload failed (${res.status}): ${err}`);
    }

    return (await res.json()) as { videoId: string; status: string };
  }

  /**
   * Aborts upload via DELETE /v1/uploads/:uploadId (SDD §3.1, §6.1, AC 20).
   */
  async abortUpload(uploadId: string): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/v1/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${this.token}`,
      },
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      throw new Error(`abortUpload failed (${res.status}): ${err}`);
    }
  }

  /**
   * Uploads an entire file from disk (handles single or multipart, resumable, concurrency 4 per AC 18).
   */
  async uploadFile(options: {
    filePath: string;
    contentType?: string;
    title?: string;
    strategy?: 'single' | 'multipart';
    concurrency?: number;
    existingUploadId?: string;
    killAtPercent?: number; // for testing simulated crash at ~50%
    onProgress?: (completedParts: number, totalParts: number) => void;
  }): Promise<{ videoId: string; uploadId: string; status: string }> {
    const {
      filePath,
      contentType = 'video/mp4',
      title,
      strategy: requestedStrategy,
      concurrency = 4, // Default concurrency 4 per AC 18
      existingUploadId,
      killAtPercent,
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
    const completedPartsMap = new Map<number, string>(); // partNumber -> etag

    if (existingUploadId) {
      // Resuming existing upload (AC 18)
      const resumeInfo = await this.getResumeInfo(existingUploadId);
      uploadId = existingUploadId;
      strategy = resumeInfo.strategy as 'single' | 'multipart';
      partSizeBytes = resumeInfo.partSizeBytes || 8 * 1024 * 1024;
      partsExpected = resumeInfo.partsExpected || 1;
      videoId = ''; // will be returned on complete

      if (resumeInfo.uploadedParts) {
        for (const p of resumeInfo.uploadedParts) {
          completedPartsMap.set(p.partNumber, p.etag);
        }
      }
    } else {
      // Initialize new upload
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

      // Populate initial part URLs
      if (init.parts) {
        for (const p of init.parts) {
          partUrlsMap.set(p.partNumber, p.url);
        }
      }
    }

    // Parallel upload of parts with concurrency limit (concurrency 4 per AC 18)
    const missingParts: number[] = [];
    for (let p = 1; p <= partsExpected; p++) {
      if (!completedPartsMap.has(p)) {
        missingParts.push(p);
      }
    }

    let nextMissingIndex = 0;
    const fd = fs.openSync(filePath, 'r');

    const abortController = new AbortController();

    try {
      const uploadWorker = async (): Promise<void> => {
        while (nextMissingIndex < missingParts.length) {
          if (abortController.signal.aborted) break;

          const partNumber = missingParts[nextMissingIndex++];
          if (!partNumber) break;

          // If simulating a crash at killAtPercent, do not start parts beyond the crash threshold (AC 18)
          if (killAtPercent !== undefined) {
            const maxPartsAllowed = Math.ceil(partsExpected * (killAtPercent / 100));
            if (partNumber > maxPartsAllowed) {
              break;
            }
          }

          // Fetch part URL if not cached
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

          // Read slice from file
          const startOffset = (partNumber - 1) * partSizeBytes;
          const currentPartSize = Math.min(partSizeBytes, sizeBytes - startOffset);
          const buffer = Buffer.alloc(currentPartSize);
          fs.readSync(fd, buffer, 0, currentPartSize, startOffset);

          // Upload part directly to storage via presigned PUT URL
          let putRes: Response;
          try {
            putRes = await fetch(partUrl, {
              method: 'PUT',
              body: buffer,
              signal: abortController.signal,
            });
          } catch (err) {
            if (abortController.signal.aborted) return;
            throw err;
          }

          if (!putRes.ok) {
            throw new Error(`Upload of part ${partNumber} failed with status ${putRes.status}`);
          }

          const etagRaw = putRes.headers.get('etag') || `"etag-${partNumber}"`;
          const etag = etagRaw.replace(/^"|"$/g, '');
          completedPartsMap.set(partNumber, etag);

          if (onProgress) {
            onProgress(completedPartsMap.size, partsExpected);
          }

          // Check if simulated crash threshold reached (AC 18)
          if (killAtPercent !== undefined) {
            const currentPercent = (completedPartsMap.size / partsExpected) * 100;
            if (currentPercent >= killAtPercent) {
              abortController.abort();
              throw new ClientCrashedError(
                `Simulated client crash reached at ${currentPercent.toFixed(1)}% (${completedPartsMap.size}/${partsExpected} parts)`
              );
            }
          }
        }
      };

      // Run concurrency workers
      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(concurrency, missingParts.length); i++) {
        workers.push(uploadWorker());
      }
      await Promise.all(workers);
    } finally {
      fs.closeSync(fd);
    }

    // Complete upload
    const sortedParts = Array.from(completedPartsMap.entries())
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
