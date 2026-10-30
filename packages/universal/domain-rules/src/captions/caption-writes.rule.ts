import { type CaptionTrack, isGeneratedTrack, MAX_CAPTION_TRACKS } from '@vp/domain';
import { err, ok, type Result } from '@vp/result';
import {
  type CaptionLanguageTaken,
  type CaptionOverwriteUnconfirmed,
  type CaptionTrackLimit,
  captionLanguageTaken,
  captionOverwriteUnconfirmed,
  captionTrackLimit,
} from './failures';

/** Replacing the track of a language a video already has never counts against the limit. */
export function decideCaptionUpload(
  videoId: string,
  tracks: readonly CaptionTrack[],
  language: string
): Result<void, CaptionTrackLimit> {
  const replaces = tracks.some((track) => track.language === language);
  return replaces || tracks.length < MAX_CAPTION_TRACKS
    ? ok()
    : err(captionTrackLimit(videoId, MAX_CAPTION_TRACKS));
}

export interface GenerateRequest {
  readonly language: string | null;
  readonly overwrite: boolean;
}

export type GenerateCaptionsFailure = CaptionLanguageTaken | CaptionOverwriteUnconfirmed;

/**
 * The generated track a new run replaces, or `null` when the video has none yet. A creator's edits
 * are lost to the run, so an edited track goes only when the creator said so.
 */
export function decideCaptionGenerate(
  videoId: string,
  tracks: readonly CaptionTrack[],
  request: GenerateRequest
): Result<CaptionTrack | null, GenerateCaptionsFailure> {
  const generated = tracks.find(isGeneratedTrack) ?? null;
  const { language } = request;
  if (language !== null && tracks.some((t) => t !== generated && t.language === language)) {
    return err(captionLanguageTaken(videoId, language));
  }
  if (generated?.kind === 'edited' && !request.overwrite) {
    return err(captionOverwriteUnconfirmed(videoId, generated.id));
  }
  return ok(generated);
}
