import type { CaptionTrackView, TranscriptView } from '@vp/api-contracts';
import type { CaptionTrack, TranscriptCue } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { captionsFileKey } from '@vp/storage';
import { cdnUrl } from './video-views';

/** `reason` and `version` are what a manager acts on; a viewer gets neither. */
export function toCaptionTrackView(
  track: CaptionTrack,
  cdn: CdnBase,
  manager: boolean
): CaptionTrackView {
  const { id, language, kind, status } = track;
  const url =
    status === 'ready' && language !== null
      ? cdnUrl(cdn, captionsFileKey(track.videoId, language))
      : null;
  const view = { id, language, kind, status, url };
  return manager ? { ...view, reason: track.reason, version: track.version } : view;
}

export function toTranscriptView(track: CaptionTrack, cues: TranscriptCue[]): TranscriptView {
  return { captionId: track.id, language: track.language, kind: track.kind, cues };
}
