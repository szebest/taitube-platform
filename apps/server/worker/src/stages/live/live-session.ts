import type { StorageClient } from '@vp/core/ports';
import type { LivePackaging } from '@vp/env-schema';
import type { StorageUnavailable } from '@vp/errors';
import {
  type Fmp4Fragment,
  type LlHlsPart,
  type LlHlsSegment,
  renderArchivePlaylist,
  renderLivePlaylist,
} from '@vp/ffmpeg';
import { andThenAsync, isErr, map, ok, parseJson, type Result } from '@vp/result';
import {
  getHeaderMapping,
  LIVE_INIT_HEADERS,
  LIVE_PLAYLIST_HEADERS,
  liveArchivePlaylistKey,
  liveArchiveStateKey,
  liveInitKey,
  livePartKey,
  livePlaylistKey,
  liveRelativeUri,
  liveSegmentKey,
} from '@vp/storage';
import { z } from 'zod';
import type { LiveUploader } from './live-uploader';

const ArchiveSegment = z.object({
  sequence: z.number().int().min(0),
  discontinuity: z.number().int().min(0),
  mapUri: z.string(),
  uri: z.string(),
  durationMs: z.number().positive(),
});

/** What survives a packager restart: how many epochs ran, and every whole segment so far. */
const LiveArchiveSchema = z.object({
  epochs: z.number().int().min(0),
  segments: z.array(ArchiveSegment),
});

export interface LiveArchive {
  epochs: number;
  segments: LlHlsSegment[];
}

const EMPTY_ARCHIVE: LiveArchive = { epochs: 0, segments: [] };

/** The archive a previous run of this broadcast left behind, or an empty one for its first run. */
export async function loadLiveArchive(
  storage: StorageClient,
  bucket: string,
  streamId: string
): Promise<Result<LiveArchive, StorageUnavailable>> {
  const key = liveArchiveStateKey(streamId);
  const found = await storage.headObject(bucket, key);
  return andThenAsync(found, async (head) => {
    if (head === null) return ok(EMPTY_ARCHIVE);
    return map(await storage.getObject(bucket, key), (body) => {
      const json = parseJson(body.toString('utf-8'));
      const parsed = isErr(json) ? undefined : LiveArchiveSchema.safeParse(json.value);
      return parsed?.success
        ? { ...parsed.data, segments: parsed.data.segments.map((s) => ({ ...s, parts: [] })) }
        : EMPTY_ARCHIVE;
    });
  });
}

/** Writes the archive's state and its playlist, the pair a restart and a replay each read. */
export function writeLiveArchive(
  uploader: LiveUploader,
  streamId: string,
  archive: LiveArchive,
  options: { segmentMs: number; ended: boolean }
): void {
  const state = {
    epochs: archive.epochs,
    segments: archive.segments.map(({ parts: _parts, ...segment }) => segment),
  };
  uploader.enqueue(() =>
    uploader.put(liveArchiveStateKey(streamId), JSON.stringify(state), getHeaderMapping('.json'))
  );
  uploader.enqueue(() =>
    uploader.put(
      liveArchivePlaylistKey(streamId),
      renderArchivePlaylist({ segments: archive.segments, ...options }),
      LIVE_PLAYLIST_HEADERS
    )
  );
}

/**
 * One run of the packager over a broadcast. It is an epoch of its own: its init segment and media
 * sit in their own directory, and its first segment opens a discontinuity after a previous run's.
 */
export class LiveSession {
  private readonly epoch: number;
  private readonly discontinuity: number;
  private readonly segments: LlHlsSegment[];
  private readonly partsPerSegment: number;
  private sequence: number;
  private mapUri = '';
  private parts: LlHlsPart[] = [];
  private bytes: Uint8Array[] = [];

  constructor(
    private readonly streamId: string,
    private readonly packaging: LivePackaging,
    private readonly uploader: LiveUploader,
    archive: LiveArchive
  ) {
    const last = archive.segments.at(-1);
    this.epoch = archive.epochs;
    this.discontinuity = last === undefined ? 0 : last.discontinuity + 1;
    this.sequence = last === undefined ? 0 : last.sequence + 1;
    this.segments = [...archive.segments];
    this.partsPerSegment = packaging.segmentMs / packaging.partMs;
  }

  get archive(): LiveArchive {
    return { epochs: this.epoch + 1, segments: [...this.segments] };
  }

  accept(fragment: Fmp4Fragment): void {
    if (fragment.type === 'init') this.acceptInit(fragment.bytes);
    else this.acceptPart(fragment.bytes);
  }

  /** Closes the segment being written, short as it may be, and settles every queued write. */
  async finish(): Promise<Result<LiveArchive, StorageUnavailable>> {
    if (this.parts.length > 0) this.closeSegment();
    return map(await this.uploader.drained(), () => this.archive);
  }

  private acceptInit(bytes: Uint8Array): void {
    const key = liveInitKey(this.streamId, this.epoch);
    this.mapUri = liveRelativeUri(this.streamId, key);
    this.uploader.enqueue(() => this.uploader.put(key, bytes, LIVE_INIT_HEADERS));
  }

  private acceptPart(bytes: Uint8Array): void {
    const index = this.parts.length;
    const key = livePartKey(this.streamId, this.epoch, this.sequence, index);
    this.uploader.enqueue(() => this.uploader.put(key, bytes, getHeaderMapping(key)));
    this.parts.push({
      uri: liveRelativeUri(this.streamId, key),
      durationMs: this.packaging.partMs,
      independent: index === 0,
    });
    this.bytes.push(bytes);

    if (this.parts.length === this.partsPerSegment) this.closeSegment();
    this.writePlaylist();
  }

  private closeSegment(): void {
    const key = liveSegmentKey(this.streamId, this.epoch, this.sequence);
    const body = Buffer.concat(this.bytes);
    this.uploader.enqueue(() => this.uploader.put(key, body, getHeaderMapping(key)));
    this.segments.push({
      sequence: this.sequence,
      discontinuity: this.discontinuity,
      mapUri: this.mapUri,
      uri: liveRelativeUri(this.streamId, key),
      durationMs: this.parts.reduce((total, part) => total + part.durationMs, 0),
      parts: this.parts,
    });
    this.sequence += 1;
    this.parts = [];
    this.bytes = [];
    writeLiveArchive(this.uploader, this.streamId, this.archive, {
      segmentMs: this.packaging.segmentMs,
      ended: false,
    });
  }

  private writePlaylist(): void {
    const { segmentMs, partMs, partSegments, windowSegments } = this.packaging;
    const playlist = renderLivePlaylist({
      segments: this.segments.slice(-windowSegments),
      open: {
        sequence: this.sequence,
        discontinuity: this.discontinuity,
        mapUri: this.mapUri,
        parts: this.parts,
      },
      segmentMs,
      partMs,
      partSegments,
    });
    this.uploader.enqueue(() =>
      this.uploader.put(livePlaylistKey(this.streamId), playlist, LIVE_PLAYLIST_HEADERS)
    );
  }
}
