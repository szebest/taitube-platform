import type { LiveStream, VideoVisibility } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { NewOutboxInput } from './outbox-repository';
import type { NewVideoInput } from './video-repository';

/** What a new `IDLE` row is minted with when its channel has none to hand the credentials on. */
export interface LiveStreamSeed {
  id: string;
  streamKey: string;
  overlayToken: string;
  controlToken: string;
}

export interface GoLiveInput {
  streamId: string;
  /** The video the broadcast is, written `LIVE` in the same transaction. */
  video: NewVideoInput;
  startedAt: Date;
  /** Committed with the transition: the packager's job and the subscribers' notification. */
  outbox: readonly NewOutboxInput[];
}

export interface EndLiveInput {
  streamId: string;
  endedAt: Date;
  /** The id the next `IDLE` row takes, inheriting the key and tokens of the one that ended. */
  nextId: string;
}

export interface LiveStreamPatch {
  title?: string;
  description?: string;
  visibility?: VideoVisibility;
  archiveVisibility?: VideoVisibility;
}

/**
 * A channel has at most one open stream, `IDLE` or `LIVE`. Every transition is a compare-and-set on
 * the status: a lost race answers `ok(null)`, and the caller reads the row again to learn why.
 */
export interface LiveStreamRepositoryPort {
  /** The channel's open stream, minted from `seed` when it has none. */
  ensureIdle(
    channelId: string,
    seed: LiveStreamSeed
  ): Promise<Result<LiveStream, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  findByKey(streamKey: string): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  findOpenByChannel(channelId: string): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  findByVideoId(videoId: string): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  /** `IDLE -> LIVE` with its video, the video event and the outbox rows, in one transaction. */
  goLive(input: GoLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  /**
   * `LIVE -> ENDED`, moving the key and tokens to a fresh `IDLE` row. Ending a stream that already
   * ended answers it unchanged, so a retried end is harmless.
   */
  end(input: EndLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  /** Marks a `LIVE` stream as stopping, so the ingest refuses a reconnect; `ok(null)` if it is not live. */
  requestStop(id: string, at: Date): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
  /**
   * While the stream is `LIVE`, its video takes the title (unless empty), description and visibility
   * in the same transaction; `archiveVisibility` waits for the end.
   */
  update(
    id: string,
    patch: LiveStreamPatch
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>>;
}
