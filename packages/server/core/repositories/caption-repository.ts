import type { CaptionTrack, TranscriptCue } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export type CaptionRecord = CaptionTrack;

/** What decides whether a video is captioned: its own switch over its channel's default. */
export interface CaptionSettings {
  videoId: string;
  ownerId: string;
  autoCaptions: boolean | null;
  channelDefault: boolean;
}

export interface NewGeneratedTrack {
  id: string;
  videoId: string;
  language: string | null;
  modelVersion: string;
  status: 'pending' | 'disabled';
  reason: string | null;
}

export interface CompleteGeneratedTrack {
  id: string;
  expectedVersion: number;
  language: string;
  detectedLanguage: string | null;
  cues: TranscriptCue[];
}

export interface FailGeneratedTrack {
  id: string;
  expectedVersion: number;
  status: 'failed' | 'disabled';
  reason: string;
}

export interface RegenerateTrack {
  id: string;
  expectedVersion: number;
  modelVersion: string;
  language: string | null;
}

export interface UploadTrack {
  /** Used only when no track holds the language yet. */
  id: string;
  videoId: string;
  language: string;
  cues: TranscriptCue[];
}

export interface EditCueText {
  id: string;
  expectedVersion: number;
  cues: Pick<TranscriptCue, 'index' | 'text'>[];
}

/**
 * A write lands on the version it was asked against or not at all: `stale` when the track moved on
 * (or is gone), `language-taken` when a finished generated track detects a language another track
 * already holds.
 */
export type CaptionCommit =
  | { type: 'committed'; track: CaptionRecord }
  | { type: 'stale' }
  | { type: 'language-taken' };

/**
 * Every status change is a compare-and-set on the track's `version` and appends a `captions.*` row to
 * `video_events` in the same transaction; a track that becomes `ready` or `failed` also tells the
 * video's owner on the user event stream. The video row is never written.
 */
export abstract class CaptionRepository {
  abstract settings(videoId: string): Promise<Result<CaptionSettings | null, DatabaseUnavailable>>;
  /** `false` when the video is not there. */
  abstract setAutoCaptions(
    videoId: string,
    autoCaptions: boolean | null
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /** `false` when the owner has no channel. */
  abstract setChannelDefault(
    ownerId: string,
    enabled: boolean
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract list(videoId: string): Promise<Result<CaptionRecord[], DatabaseUnavailable>>;
  abstract findById(id: string): Promise<Result<CaptionRecord | null, DatabaseUnavailable>>;
  abstract findGenerated(
    videoId: string
  ): Promise<Result<CaptionRecord | null, DatabaseUnavailable>>;
  abstract findByLanguage(
    videoId: string,
    language: string
  ): Promise<Result<CaptionRecord | null, DatabaseUnavailable>>;
  /** Idempotent: a video that already has a generated track gets that track back, unchanged. */
  abstract createGenerated(
    track: NewGeneratedTrack
  ): Promise<Result<CaptionRecord, DatabaseUnavailable>>;
  /** `pending` to `ready`, replacing the cues. */
  abstract complete(
    input: CompleteGeneratedTrack
  ): Promise<Result<CaptionCommit, DatabaseUnavailable>>;
  /** `pending` to `failed` or `disabled`; the cues stay as they were. */
  abstract fail(input: FailGeneratedTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>>;
  /** Back to `pending` as an `auto` track, for a new run. */
  abstract regenerate(input: RegenerateTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>>;
  /** Creates or replaces the track of that language as `uploaded` and `ready`. */
  abstract upload(input: UploadTrack): Promise<Result<CaptionCommit, DatabaseUnavailable>>;
  /** Rewrites cue text, timing untouched; a generated track becomes `edited`. */
  abstract editCues(input: EditCueText): Promise<Result<CaptionCommit, DatabaseUnavailable>>;
  abstract delete(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** In cue order; `query` keeps the cues whose words match it (`websearch_to_tsquery`). */
  abstract cues(
    captionId: string,
    query?: string
  ): Promise<Result<TranscriptCue[], DatabaseUnavailable>>;
  /** Generated tracks still `pending` this long after their last change, oldest first. */
  abstract listStalePending(
    olderThanMs: number,
    limit: number
  ): Promise<Result<CaptionRecord[], DatabaseUnavailable>>;
}
