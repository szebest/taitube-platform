export const CAPTION_KINDS = ['auto', 'edited', 'uploaded'] as const;
export type CaptionKind = (typeof CAPTION_KINDS)[number];

export const CAPTION_STATUSES = ['pending', 'ready', 'failed', 'disabled'] as const;
type CaptionStatus = (typeof CAPTION_STATUSES)[number];

export const MAX_CAPTION_TRACKS = 10;
export const MAX_CAPTION_FILE_BYTES = 1_048_576;

/**
 * One track of one video. The generated track (`auto`, or `edited` once a creator changed a cue) has
 * no language until speech-to-text detects it, unless the creator gave a hint; an `uploaded` track
 * always has one.
 */
export interface CaptionTrack {
  id: string;
  videoId: string;
  language: string | null;
  detectedLanguage: string | null;
  kind: CaptionKind;
  status: CaptionStatus;
  modelVersion: string | null;
  /** Why a track is `disabled` (`NO_AUDIO`) or `failed` (the error code), else `null`. */
  reason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** A video's own switch wins; `null` follows its channel's default. */
export function autoCaptionsEnabled(video: boolean | null, channelDefault: boolean): boolean {
  return video ?? channelDefault;
}

export function isGeneratedTrack(track: Pick<CaptionTrack, 'kind'>): boolean {
  return track.kind !== 'uploaded';
}
