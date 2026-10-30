import type { CaptionTrack } from '@vp/domain';
import { isGeneratedTrack } from '@vp/domain';
import { err, ok, type Result } from '@vp/result';
import { type CaptionNotFound, captionNotFound } from './failures';

export interface TrackAudience {
  readonly manager: boolean;
  /** The video's own switch; an explicit `false` hides its generated track and keeps the row. */
  readonly autoCaptions: boolean | null;
}

/** A manager sees every track in every state; a viewer only what is ready and switched on. */
export function visibleCaptionTracks(
  tracks: readonly CaptionTrack[],
  audience: TrackAudience
): CaptionTrack[] {
  if (audience.manager) return [...tracks];
  return tracks.filter(
    (track) =>
      track.status === 'ready' && !(isGeneratedTrack(track) && audience.autoCaptions === false)
  );
}

/**
 * The track a transcript reads: the one in `language`, else the generated track when it is ready,
 * else the first ready one.
 */
export function decideTranscriptTrack(
  videoId: string,
  visible: readonly CaptionTrack[],
  language: string | null
): Result<CaptionTrack, CaptionNotFound> {
  const ready = visible.filter((track) => track.status === 'ready');
  const track =
    language === null
      ? (ready.find(isGeneratedTrack) ?? ready[0])
      : ready.find((candidate) => candidate.language === language);
  return track ? ok(track) : err(captionNotFound(videoId, language));
}
