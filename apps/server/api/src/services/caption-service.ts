import type { CaptionListView, CaptionTrackView, TranscriptView } from '@vp/api-contracts';
import type { VideoRepository } from '@vp/core/repositories';
import { type CaptionTrack, type Video, autoCaptionsEnabled } from '@vp/domain';
import {
  type CaptionNotFound,
  type CaptionsAccess,
  type ChannelNotFound,
  type GenerateCaptionsFailure,
  channelNotFound,
  decideCaptionGenerate,
  decideTranscriptTrack,
  videoNotFound,
  visibleCaptionTracks,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { type InvalidCaptionLanguage, validateCaptionLanguage } from '@vp/validation';
import { type CaptionAccessFailure, manageCaptions, readCaptions } from './caption-access';
import { type CaptionRunDeps, type CaptionRunFailure, startCaptionRun } from './caption-runs';
import { toCaptionTrackView, toTranscriptView } from './caption-views';
import type { DispatchOrigin } from './probe-dispatch';

export interface CaptionServiceDeps extends CaptionRunDeps {
  videos: VideoRepository;
  cdn: CdnBase;
}

export interface TranscriptQuery {
  lang?: string;
  q?: string;
}

export interface GenerateCaptionsBody {
  language?: string | null;
  overwrite?: boolean;
}

type GenerateFailure =
  | CaptionAccessFailure
  | InvalidCaptionLanguage
  | GenerateCaptionsFailure
  | CaptionRunFailure;

interface VisibleTracks {
  tracks: CaptionTrack[];
  settings: { autoCaptions: boolean | null; channelDefault: boolean };
}

/**
 * What a video's captions look like to the caller, and the speech-to-text runs behind the generated
 * track: the per-video switch, the channel default and an explicit regenerate.
 */
export class CaptionService {
  constructor(private readonly deps: CaptionServiceDeps) {}

  async list(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<CaptionListView, CaptionAccessFailure>> {
    const access = await readCaptions(this.deps.videos, viewer, videoId);
    if (isErr(access)) return access;
    return await this.listView(access.value);
  }

  async transcript(
    viewer: UserContext | null,
    videoId: string,
    query: TranscriptQuery
  ): Promise<
    Result<TranscriptView, CaptionAccessFailure | InvalidCaptionLanguage | CaptionNotFound>
  > {
    const language =
      query.lang === undefined ? ok(null) : validateCaptionLanguage('lang', query.lang);
    if (isErr(language)) return language;
    const access = await readCaptions(this.deps.videos, viewer, videoId);
    if (isErr(access)) return access;
    const visible = await this.visibleTracks(access.value);
    if (isErr(visible)) return visible;

    const track = decideTranscriptTrack(videoId, visible.value.tracks, language.value);
    if (isErr(track)) return track;
    const cues = await this.deps.captions.cues(track.value.id, query.q?.trim() || undefined);
    return map(cues, (found) => toTranscriptView(track.value, found));
  }

  /** A missing or failed generated track starts when the switch turns captions on for the video. */
  async setAutoCaptions(
    actor: UserContext,
    videoId: string,
    autoCaptions: boolean | null,
    origin: DispatchOrigin
  ): Promise<Result<CaptionListView, CaptionAccessFailure | CaptionRunFailure>> {
    const video = await manageCaptions(this.deps.videos, actor, videoId);
    if (isErr(video)) return video;
    const stored = await this.deps.captions.setAutoCaptions(videoId, autoCaptions);
    if (isErr(stored)) return stored;
    if (!stored.value) return err(videoNotFound(videoId));

    const settings = await this.deps.captions.settings(videoId);
    if (isErr(settings)) return settings;
    if (settings.value && autoCaptionsEnabled(autoCaptions, settings.value.channelDefault)) {
      const started = await this.startWhenMissing(video.value, origin);
      if (isErr(started)) return started;
    }
    return await this.listView({ video: video.value, manager: true });
  }

  async generate(
    actor: UserContext,
    videoId: string,
    body: GenerateCaptionsBody,
    origin: DispatchOrigin
  ): Promise<Result<CaptionTrackView, GenerateFailure>> {
    const language = body.language ? validateCaptionLanguage('language', body.language) : ok(null);
    if (isErr(language)) return language;
    const video = await manageCaptions(this.deps.videos, actor, videoId);
    if (isErr(video)) return video;
    const tracks = await this.deps.captions.list(videoId);
    if (isErr(tracks)) return tracks;

    const replaced = decideCaptionGenerate(videoId, tracks.value, {
      language: language.value,
      overwrite: body.overwrite ?? false,
    });
    if (isErr(replaced)) return replaced;
    const started = await startCaptionRun(
      this.deps,
      video.value,
      replaced.value,
      language.value,
      origin
    );
    return map(started, (track) => toCaptionTrackView(track, this.deps.cdn, true));
  }

  async setChannelDefault(
    actor: UserContext,
    enabled: boolean
  ): Promise<Result<{ enabled: boolean }, ChannelNotFound | DatabaseUnavailable>> {
    const stored = await this.deps.captions.setChannelDefault(actor.id, enabled);
    if (isErr(stored)) return stored;
    return stored.value ? ok({ enabled }) : err(channelNotFound(actor.id));
  }

  private async visibleTracks({
    video,
    manager,
  }: CaptionsAccess): Promise<Result<VisibleTracks, CaptionAccessFailure>> {
    const settings = await this.deps.captions.settings(video.id);
    if (isErr(settings)) return settings;
    if (!settings.value) return err(videoNotFound(video.id));
    const { autoCaptions, channelDefault } = settings.value;
    const tracks = await this.deps.captions.list(video.id);
    return map(tracks, (all) => ({
      tracks: visibleCaptionTracks(all, { manager, autoCaptions }),
      settings: { autoCaptions, channelDefault },
    }));
  }

  private async listView(
    access: CaptionsAccess
  ): Promise<Result<CaptionListView, CaptionAccessFailure>> {
    const visible = await this.visibleTracks(access);
    return map(visible, ({ tracks, settings }) => ({
      tracks: tracks.map((track) => toCaptionTrackView(track, this.deps.cdn, access.manager)),
      ...(access.manager ? { settings } : {}),
    }));
  }

  /**
   * A generated track that is running, ready or has no audio is left alone. A video probe has not
   * measured yet is left to probe, which starts the run once it knows the duration.
   */
  private async startWhenMissing(
    video: Video,
    origin: DispatchOrigin
  ): Promise<Result<void, CaptionRunFailure>> {
    const generated = await this.deps.captions.findGenerated(video.id);
    if (isErr(generated)) return generated;
    const track = generated.value;
    if (!video.durationMs || (track && track.status !== 'failed')) return ok();
    const started = await startCaptionRun(this.deps, video, track, track?.language ?? null, origin);
    return map(started, () => undefined);
  }
}
