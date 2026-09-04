import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, TransientError } from '@vp/errors';
import type { Logger } from '@vp/observability';
import { getHeaderMapping } from '@vp/storage';

export interface SegmentUploaderOptions {
  outputDir: string;
  videoId: string;
  rendition: string;
  publicBucket: string;
  storage: StorageClient;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  logger: Logger;
}

export interface UploaderResult {
  segmentCount: number;
  totalBytes: number;
  playlistKey: string;
}

/**
 * StreamingSegmentUploader watches the transcode output directory, uploads each completed
 * .ts segment as soon as FFmpeg renames it from .tmp (bounded concurrency 4), deletes it locally,
 * and uploads index.m3u8 ONLY after every segment upload has succeeded (SDD §8.2, §9.7, Ticket 14 AC 1, 2).
 */
export class StreamingSegmentUploader {
  private readonly outputDir: string;
  private readonly videoId: string;
  private readonly rendition: string;
  private readonly publicBucket: string;
  private readonly storage: StorageClient;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly logger: Logger;

  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private queue: string[] = [];
  private readonly queuedSet = new Set<string>();
  private readonly uploaded = new Map<string, number>(); // filename -> sizeBytes
  private fatalError: Error | null = null;
  private activeWorkers = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(options: SegmentUploaderOptions) {
    this.outputDir = options.outputDir;
    this.videoId = options.videoId;
    this.rendition = options.rendition;
    this.publicBucket = options.publicBucket;
    this.storage = options.storage;
    this.concurrency = options.concurrency ?? 4;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 150;
    this.logger = options.logger.child({
      component: 'streaming-uploader',
      rendition: options.rendition,
    });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.pollTimer = setInterval(() => {
      this.scanDirectory().catch((err) => {
        if (!this.fatalError) this.fatalError = err;
      });
    }, 100);
    this.scanDirectory().catch(() => {});
  }

  private async scanDirectory(): Promise<void> {
    if (this.fatalError) return;
    try {
      const files = await fs.readdir(this.outputDir);
      for (const file of files) {
        // FFmpeg writes seg_%05d.ts.tmp then renames to seg_%05d.ts
        if (file.endsWith('.ts') && !file.endsWith('.tmp')) {
          if (!this.queuedSet.has(file)) {
            this.queuedSet.add(file);
            this.queue.push(file);
          }
        }
      }
      this.scheduleWork();
    } catch {
      // Directory may not be created yet or in transition
    }
  }

  private scheduleWork(): void {
    while (this.activeWorkers < this.concurrency && this.queue.length > 0 && !this.fatalError) {
      const file = this.queue.shift();
      if (!file) break;
      this.activeWorkers++;
      this.uploadSegment(file)
        .catch(() => {})
        .finally(() => {
          this.activeWorkers--;
          this.checkIdle();
          this.scheduleWork();
        });
    }
  }

  private async uploadSegment(filename: string): Promise<void> {
    const filePath = path.join(this.outputDir, filename);
    const key = `videos/${this.videoId}/hls/${this.rendition}/${filename}`;
    const headers = getHeaderMapping(filename);

    let attempts = 0;
    while (attempts < this.maxRetries) {
      attempts++;
      try {
        const stat = await fs.stat(filePath);
        const body = await fs.readFile(filePath);

        await this.storage.uploadObject({
          bucket: this.publicBucket,
          key,
          body,
          contentType: headers.contentType,
          cacheControl: headers.cacheControl,
        });

        // Delete immediately after successful upload to keep local disk bounded
        await fs.unlink(filePath).catch(() => {});
        this.uploaded.set(filename, stat.size);
        return;
      } catch (err: unknown) {
        this.logger.warn(
          {
            filename,
            attempt: attempts,
            maxRetries: this.maxRetries,
            error: (err as Error).message,
          },
          `Segment upload attempt ${attempts} failed, retrying...`
        );

        if (attempts >= this.maxRetries) {
          const transErr = new TransientError(
            ErrorCodes.STORAGE_UNAVAILABLE,
            `Failed to upload segment ${filename} after ${attempts} attempts: ${(err as Error).message}`
          );
          this.fatalError = transErr;
          this.checkIdle();
          throw transErr;
        }

        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempts));
      }
    }
  }

  private checkIdle(): void {
    if ((this.queue.length === 0 && this.activeWorkers === 0) || this.fatalError) {
      const resolvers = this.idleResolvers;
      this.idleResolvers = [];
      for (const r of resolvers) r();
    }
  }

  private async waitForIdle(): Promise<void> {
    if ((this.queue.length === 0 && this.activeWorkers === 0) || this.fatalError) return;
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  async stop(success: boolean): Promise<UploaderResult | null> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;

    if (!success) {
      return null;
    }

    // Drain remaining completed segments
    await this.scanDirectory();
    await this.waitForIdle();

    if (this.fatalError) {
      throw this.fatalError;
    }

    // Playlist object is written ONLY after every segment upload succeeded (AC 2, SDD §9.7)
    const playlistPath = path.join(this.outputDir, 'index.m3u8');
    let playlistContent: Buffer;
    try {
      playlistContent = await fs.readFile(playlistPath);
    } catch {
      throw new Error(`Playlist index.m3u8 not found in ${this.outputDir}`);
    }

    const playlistKey = `videos/${this.videoId}/hls/${this.rendition}/index.m3u8`;
    const playlistHeaders = getHeaderMapping('index.m3u8');

    await this.storage.uploadObject({
      bucket: this.publicBucket,
      key: playlistKey,
      body: playlistContent,
      contentType: playlistHeaders.contentType,
      cacheControl: playlistHeaders.cacheControl,
    });

    await fs.unlink(playlistPath).catch(() => {});

    let totalBytes = playlistContent.byteLength;
    for (const size of this.uploaded.values()) {
      totalBytes += size;
    }

    return {
      segmentCount: this.uploaded.size,
      totalBytes,
      playlistKey,
    };
  }
}
