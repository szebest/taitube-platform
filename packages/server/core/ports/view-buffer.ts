import type { Result } from '@kit/result';
import type {
  ExperimentMeasure,
  ExperimentVariantId,
  PlaylistEvent,
  ViewBatch,
  ViewDate,
  ViewDevice,
  ViewHour,
} from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';

export interface ViewEvent {
  readonly videoId: string;
  readonly viewerId: string;
  readonly viewDate: ViewDate;
  readonly viewHour: ViewHour;
}

export interface ExperimentShown {
  readonly experimentId: string;
  readonly variantId: ExperimentVariantId;
}

export interface PlaybackWatch {
  readonly videoId: string;
  readonly sessionId: string;
  readonly viewDate: ViewDate;
  readonly viewHour: ViewHour;
  readonly device: ViewDevice;
  readonly watchedSeconds: number;
  readonly requiredSeconds: number;
  /** The share link the page came through: its watch seconds and its counted view go to it too. */
  readonly shareLinkId: string | null;
  /** The test variant the page showed: its watch seconds go to it too. */
  readonly experiment: ExperimentShown | null;
}

export interface ShareLinkOpen {
  /** The video or playlist the link opens. */
  readonly targetId: string;
  readonly linkId: string;
  /** The signed-in viewer's id, else something as ephemeral; counted once per link and day. */
  readonly viewerKey: string;
  readonly viewDate: ViewDate;
}

export interface PlaylistOpen {
  readonly playlistId: string;
  /** The signed-in viewer's id, else the tab's session key; counted once per playlist and day. */
  readonly viewerKey: string;
  readonly viewDate: ViewDate;
}

export interface ExperimentEvent extends ExperimentShown {
  readonly videoId: string;
  readonly viewDate: ViewDate;
  readonly measure: ExperimentMeasure;
}

export type PlaylistBufferEvent = PlaylistEvent & { readonly viewDate: ViewDate };

/** `pending`: this event decided nothing, the session is short of the required seconds or already counted. */
export type PlaybackWatchOutcome = 'counted' | 'duplicate' | 'pending';

export interface RetentionMilestone {
  readonly videoId: string;
  readonly sessionId: string;
  readonly percent: number;
}

/** `deferred` is held in process until the buffer is reachable; `dropped` found that hold full. */
export type ViewRecordOutcome = 'counted' | 'duplicate' | 'deferred' | 'dropped';

/**
 * Where playback beacons accumulate between flushes, so a view costs no database connection.
 * `snapshot` moves the views, the device counts, the hourly views, the retention steps and the playlist counts buffered so far under the batch id and hands back the batch still
 * pending from an earlier flush if one never released, which is what makes a crash mid-flush lose
 * nothing; `release` is called only once the batch is durable elsewhere.
 */
export interface ViewBufferPort {
  record(view: ViewEvent): Promise<Result<ViewRecordOutcome, CacheUnavailable>>;
  /** Records each view as `record` would, in one round trip; outcomes follow the input order. */
  recordAll(views: readonly ViewEvent[]): Promise<Result<ViewRecordOutcome[], CacheUnavailable>>;
  /**
   * Adds every second of a playback event to the day's watch time, and counts the viewer once the
   * session has watched `requiredSeconds` in all, deduplicated per session, video and day. The device
   * is counted with the view and with nothing else.
   */
  recordPlayback(playback: PlaybackWatch): Promise<Result<PlaybackWatchOutcome, CacheUnavailable>>;
  snapshot(batchId: string): Promise<Result<ViewBatch | null, CacheUnavailable>>;
  release(batchId: string): Promise<Result<void, CacheUnavailable>>;
  /**
   * Counts the session at every 5 percent step from where it last was up to `percent`, so a
   * session adds one viewer to each step it reaches however many beacons it sends.
   */
  recordRetention(milestone: RetentionMilestone): Promise<Result<void, CacheUnavailable>>;
  /** One open per viewer, link and day, kept distinct as the views are, through the day's sketch. */
  recordShareLinkOpen(open: ShareLinkOpen): Promise<Result<ViewRecordOutcome, CacheUnavailable>>;
  /** Adds one impression or start per event, in one round trip. */
  recordExperimentEvents(
    events: readonly ExperimentEvent[]
  ): Promise<Result<void, CacheUnavailable>>;
  /** One open per viewer, playlist and day, kept distinct as the link opens are. */
  recordPlaylistOpen(open: PlaylistOpen): Promise<Result<ViewRecordOutcome, CacheUnavailable>>;
  /** Adds one per event to its playlist's day, and a play to its video's day too, in one round trip. */
  recordPlaylistEvents(
    events: readonly PlaylistBufferEvent[]
  ): Promise<Result<void, CacheUnavailable>>;
}
