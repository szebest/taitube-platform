import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, err, fromPromise, ignore, isErr, ok, unwrapOr } from '@vp/result';
import { getHeaderMapping, renditionObjectKey, renditionPlaylistKey } from '@vp/storage';

export interface SegmentUploaderOptions {
  outputDir: string;
  videoId: string;
  generation: number;
  rendition: string;
  publicBucket: string;
  storage: StorageClient;
  concurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  logger: Logger;
}

export interface UploaderResult {
  segmentCount: number;
  totalBytes: number;
  playlistKey: string;
}

/** What one transcode names; the storage, the bucket and the retry policy come from composition. */
export type SegmentUploaderTarget = Pick<
  SegmentUploaderOptions,
  'outputDir' | 'videoId' | 'generation' | 'rendition' | 'logger'
>;

export interface SegmentUploader {
  start(): void;
  stop(success: boolean): Promise<Result<UploaderResult | null, MediaFailure>>;
}

const unreadable = () => null;

/** A file mid-rename, or already removed, reads as absent and is retried on the next scan. */
async function readOrNull<T>(read: () => Promise<T>): Promise<T | null> {
  return unwrapOr(await fromPromise(read, unreadable), null);
}

async function removeUploaded(filePath: string): Promise<void> {
  ignore(
    await fromPromise(() => fs.unlink(filePath), unreadable),
    'the object is uploaded; a local copy left behind goes with the scratch directory'
  );
}

/**
 * Watches the transcode output directory, uploads each completed `.ts` segment as soon as FFmpeg
 * renames it from `.tmp`, deletes it locally, and uploads `index.m3u8` only after every segment
 * upload has succeeded (SDD §8.2, §9.7).
 */
export class StreamingSegmentUploader implements SegmentUploader {
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
  private readonly uploadedBytes = new Map<string, number>();
  private fatalError: MediaFailure | null = null;
  private activeWorkers = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(options: SegmentUploaderOptions) {
    this.outputDir = options.outputDir;
    this.videoId = options.videoId;
    this.generation = options.generation;
    this.rendition = options.rendition;
    this.publicBucket = options.publicBucket;
    this.storage = options.storage;
    this.concurrency = options.concurrency;
    this.maxRetries = options.maxRetries;
    this.retryDelayMs = options.retryDelayMs;
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

    const files = await readOrNull(() => fs.readdir(this.outputDir));
    if (!files) return;

    for (const file of files) {
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
      const stat = await readOrNull(() => fs.stat(filePath));
      const body = stat ? await readOrNull(() => fs.readFile(filePath)) : null;

      if (stat && body) {
        const uploaded = await this.storage.uploadObject({
          bucket: this.publicBucket,
          key,
          body,
          contentType: headers.contentType,
          cacheControl: headers.cacheControl,
        });
        if (!isErr(uploaded)) {
          await removeUploaded(filePath);
          this.uploadedBytes.set(filename, stat.size);
          return ok();
        }
        lastMessage = uploaded.error.message;
      } else {
        lastMessage = `Segment ${filename} could not be read`;
      }

      this.logger.warn(
        { filename, attempt, maxRetries: this.maxRetries, error: lastMessage },
        'segment upload failed, retrying'
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

    await this.scanDirectory();
    await this.waitForIdle();

    if (this.fatalError) return err(this.fatalError);

    const playlistPath = path.join(this.outputDir, 'index.m3u8');
    const playlistContent = await readOrNull(() => fs.readFile(playlistPath));
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

    await removeUploaded(playlistPath);

    let totalBytes = playlistContent.byteLength;
    for (const size of this.uploadedBytes.values()) {
      totalBytes += size;
    }

    return ok({ segmentCount: this.uploadedBytes.size, totalBytes, playlistKey });
  }
}
