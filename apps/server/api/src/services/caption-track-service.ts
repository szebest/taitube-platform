import type { CaptionTrackView } from '@vp/api-contracts';
import type { StorageClient } from '@vp/core/ports';
import type { CaptionRepository, VideoRepository } from '@vp/core/repositories';
import type { CaptionTrack, TranscriptCue } from '@vp/domain';
import {
  type CaptionNotFound,
  type CaptionTrackLimit,
  captionNotFound,
  decideCaptionUpload,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { StorageUnavailable, VersionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, isErr, map, ok, type Result } from '@vp/result';
import { CAPTIONS_TRACK_HEADERS, captionsFileKey } from '@vp/storage';
import {
  type InvalidCaptionFile,
  type InvalidCaptionLanguage,
  invalidCaptionFile,
  validateCaptionLanguage,
} from '@vp/validation';
import { parseWebVtt, toWebVtt } from '@vp/whisper';
import { uuidv7 } from 'uuidv7';
import { type CaptionAccessFailure, manageCaptions } from './caption-access';
import { committed } from './caption-runs';
import { toCaptionTrackView } from './caption-views';

export interface CaptionTrackServiceDeps {
  videos: VideoRepository;
  captions: CaptionRepository;
  storage: StorageClient;
  publicBucket: string;
  cdn: CdnBase;
}

export interface CueTextEdit {
  version: number;
  cues: Pick<TranscriptCue, 'index' | 'text'>[];
}

type TrackFailure = CaptionAccessFailure | InvalidCaptionLanguage | CaptionNotFound;
type UploadFailure =
  | CaptionAccessFailure
  | InvalidCaptionLanguage
  | InvalidCaptionFile
  | CaptionTrackLimit
  | VersionConflict
  | StorageUnavailable;

interface ManagedTrack {
  track: CaptionTrack;
  language: string;
}

/**
 * The tracks a creator writes: an uploaded WebVTT file, corrected cue text, a delete. The row is
 * the source of truth; the public `.vtt` beside it is rewritten from the row after every change.
 */
export class CaptionTrackService {
  constructor(private readonly deps: CaptionTrackServiceDeps) {}

  async upload(
    actor: UserContext,
    videoId: string,
    lang: string,
    text: string
  ): Promise<Result<CaptionTrackView, UploadFailure>> {
    const language = validateCaptionLanguage('lang', lang);
    if (isErr(language)) return language;
    const parsed = parseWebVtt(text);
    if (isErr(parsed)) return err(invalidCaptionFile(parsed.error.line, parsed.error.message));
    const video = await manageCaptions(this.deps.videos, actor, videoId);
    if (isErr(video)) return video;
    const tracks = await this.deps.captions.list(videoId);
    if (isErr(tracks)) return tracks;
    const allowed = decideCaptionUpload(videoId, tracks.value, language.value);
    if (isErr(allowed)) return allowed;

    const cues = parsed.value.map((cue, index) => ({ index, ...cue }));
    const commit = await this.deps.captions.upload({
      id: uuidv7(),
      videoId,
      language: language.value,
      cues,
    });
    if (isErr(commit)) return commit;
    const track = committed(commit.value, videoId);
    if (isErr(track)) return track;
    return await this.publish(track.value, language.value, cues);
  }

  async editCues(
    actor: UserContext,
    videoId: string,
    lang: string,
    edit: CueTextEdit
  ): Promise<Result<CaptionTrackView, TrackFailure | VersionConflict | StorageUnavailable>> {
    const found = await this.managedTrack(actor, videoId, lang);
    if (isErr(found)) return found;
    const { track, language } = found.value;
    const commit = await this.deps.captions.editCues({
      id: track.id,
      expectedVersion: edit.version,
      cues: edit.cues,
    });
    if (isErr(commit)) return commit;
    const edited = committed(commit.value, track.id, edit.version);
    if (isErr(edited)) return edited;
    if (edited.value.status !== 'ready') return ok(this.view(edited.value));

    const cues = await this.deps.captions.cues(track.id);
    if (isErr(cues)) return cues;
    return await this.publish(edited.value, language, cues.value);
  }

  /** The file goes first, so a failed delete leaves the track whole and the call can be repeated. */
  async remove(
    actor: UserContext,
    videoId: string,
    lang: string
  ): Promise<Result<void, TrackFailure | StorageUnavailable>> {
    const found = await this.managedTrack(actor, videoId, lang);
    if (isErr(found)) return found;
    const { track, language } = found.value;
    const unpublished = await this.deps.storage.deleteObject(
      this.deps.publicBucket,
      captionsFileKey(videoId, language)
    );
    if (isErr(unpublished)) return unpublished;
    const deleted = await this.deps.captions.delete(track.id);
    if (isErr(deleted)) return deleted;
    return deleted.value ? ok() : err(captionNotFound(videoId, language));
  }

  private async managedTrack(
    actor: UserContext,
    videoId: string,
    lang: string
  ): Promise<Result<ManagedTrack, TrackFailure>> {
    const language = validateCaptionLanguage('lang', lang);
    if (isErr(language)) return language;
    const video = await manageCaptions(this.deps.videos, actor, videoId);
    if (isErr(video)) return video;
    const track = await this.deps.captions.findByLanguage(videoId, language.value);
    if (isErr(track)) return track;
    return track.value
      ? ok({ track: track.value, language: language.value })
      : err(captionNotFound(videoId, language.value));
  }

  private async publish(
    track: CaptionTrack,
    language: string,
    cues: TranscriptCue[]
  ): Promise<Result<CaptionTrackView, StorageUnavailable>> {
    const written = await this.deps.storage.uploadObject({
      bucket: this.deps.publicBucket,
      key: captionsFileKey(track.videoId, language),
      body: toWebVtt(cues),
      ...CAPTIONS_TRACK_HEADERS,
    });
    return map(written, () => this.view(track));
  }

  private view(track: CaptionTrack): CaptionTrackView {
    return toCaptionTrackView(track, this.deps.cdn, true);
  }
}
