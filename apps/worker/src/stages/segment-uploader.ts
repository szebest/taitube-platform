import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import type { Logger } from '@vp/observability';
import { type Result, err, isErr, ok } from '@vp/result';
import { getHeaderMapping, renditionObjectKey, renditionPlaylistKey } from '@vp/storage';

export interface SegmentUploaderOptions {
  outputDir: string;
  videoId: string;
  generation?: number;
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
  private readonly generation: number;
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
  private fatalError: MediaFailure | null = null;
  private activeWorkers = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(options: SegmentUploaderOptions) {
    this.outputDir = options.outputDir;
    this.videoId = options.videoId;
    this.generation = options.generation ?? 1;
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
      void this.scanDirectory();
    }, 100);
    void this.scanDirectory();
  }

  /** The directory may not exist yet, or be mid-rename, so an unreadable scan is simply retried. */
  private async scanDirectory(): Promise<void> {
    if (this.fatalError) return;

    const files = await fs.readdir(this.outputDir).catch(() => null);
    if (!files) return;

    for (const file of files) {
      // FFmpeg writes seg_%05d.ts.tmp then renames to seg_%05d.ts
      if (file.endsWith('.ts') && !file.endsWith('.tmp') && !this.queuedSet.has(file)) {
        this.queuedSet.add(file);
        this.queue.push(file);
      }
    }
    this.scheduleWork();
  }

  private scheduleWork(): void {
    while (this.activeWorkers < this.concurrency && this.queue.length > 0 && !this.fatalError) {
      const file = this.queue.shift();
      if (!file) break;
      this.activeWorkers++;
      this.uploadSegment(file).then((uploaded) => {
        if (isErr(uploaded) && !this.fatalError) this.fatalError = uploaded.error;
        this.activeWorkers--;
        this.checkIdle();
        this.scheduleWork();
      });
    }
  }

  private async uploadSegment(filename: string): Promise<Result<void, MediaFailure>> {
    const filePath = path.join(this.outputDir, filename);
    const key = renditionObjectKey(this.videoId, this.rendition, filename, this.generation);
    const headers = getHeaderMapping(filename);

    let lastMessage = 'unknown';

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const stat = await fs.stat(filePath).catch(() => null);
      const body = stat ? await fs.readFile(filePath).catch(() => null) : null;

      const uploaded =
        stat && body
          ? await this.storage.uploadObject({
              bucket: this.publicBucket,
              key,
              body,
              contentType: headers.contentType,
              cacheControl: headers.cacheControl,
            })
          : err({ message: `Segment ${filename} could not be read` });

      if (!isErr(uploaded)) {
        // Delete immediately after successful upload to keep local disk bounded
        await fs.unlink(filePath).catch(() => {});
        this.uploaded.set(filename, (stat as { size: number }).size);
        return ok();
      }

      lastMessage = uploaded.error.message;
      this.logger.warn(
        { filename, attempt, maxRetries: this.maxRetries, error: lastMessage },
        `Segment upload attempt ${attempt} failed, retrying...`
      );

      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }

    return err(
      mediaFailure(
        `transcode-${this.rendition}`,
        ErrorCodes.STORAGE_UNAVAILABLE,
        `Failed to upload segment ${filename} after ${this.maxRetries} attempts: ${lastMessage}`
      )
    );
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

  /** `null` means the encode failed, so there is nothing to finish uploading. */
  async stop(success: boolean): Promise<Result<UploaderResult | null, MediaFailure>> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;

    if (!success) return ok(null);

    // Drain remaining completed segments
    await this.scanDirectory();
    await this.waitForIdle();

    if (this.fatalError) return err(this.fatalError);

    // Playlist object is written ONLY after every segment upload succeeded (AC 2, SDD §9.7)
    const playlistPath = path.join(this.outputDir, 'index.m3u8');
    const playlistContent = await fs.readFile(playlistPath).catch(() => null);
    if (!playlistContent) {
      return err(
        mediaFailure(
          `transcode-${this.rendition}`,
          ErrorCodes.SEGMENT_VERIFY_FAILED,
          `Playlist index.m3u8 not found in ${this.outputDir}`
        )
      );
    }

    const playlistKey = renditionPlaylistKey(this.videoId, this.rendition, this.generation);
    const playlistHeaders = getHeaderMapping('index.m3u8');

    const uploaded = await this.storage.uploadObject({
      bucket: this.publicBucket,
      key: playlistKey,
      body: playlistContent,
      contentType: playlistHeaders.contentType,
      cacheControl: playlistHeaders.cacheControl,
    });
    if (isErr(uploaded)) {
      return err(
        mediaFailure(
          `transcode-${this.rendition}`,
          ErrorCodes.STORAGE_UNAVAILABLE,
          uploaded.error.message
        )
      );
    }

    await fs.unlink(playlistPath).catch(() => {});

    let totalBytes = playlistContent.byteLength;
    for (const size of this.uploaded.values()) {
      totalBytes += size;
    }

    return ok({ segmentCount: this.uploaded.size, totalBytes, playlistKey });
  }
}
