import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, ok } from '@kit/result';
import type { CaptionRepository, VideoRepository } from '@vp/core/repositories';
import { type Chapter, suggestChapters } from '@vp/domain';
import { type ReadVideoFailure, decideVideoEditAccess } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import type { CreatorStudioService } from './creator-studio-service';
import type { UpdateVideoServiceFailure } from './video-edit';
import type { VideoDetailView } from './video-views';

export interface ChapterServiceDeps {
  videos: VideoRepository;
  captions: CaptionRepository;
  studio: Pick<CreatorStudioService, 'update'>;
}

export type SuggestChaptersFailure = ReadVideoFailure | DatabaseUnavailable;

export class ChapterService {
  constructor(private readonly deps: ChapterServiceDeps) {}

  replace(
    user: UserContext,
    videoId: string,
    body: { chapters: Chapter[]; version: number }
  ): Promise<Result<VideoDetailView, UpdateVideoServiceFailure>> {
    return this.deps.studio.update(user, videoId, body);
  }

  /** Saves nothing: the creator edits the rows and saves them through `replace`. */
  async suggest(
    user: UserContext,
    videoId: string
  ): Promise<Result<{ items: Chapter[] }, SuggestChaptersFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = decideVideoEditAccess({ editor: user, video: found.value, videoId });
    if (isErr(video)) return video;

    const tracks = await this.deps.captions.list(videoId);
    if (isErr(tracks)) return tracks;

    // The creator's own words win over the machine's, and a track without cues is not ready yet.
    const preferred = tracks.value.toSorted(
      (a, b) => Number(a.kind === 'auto') - Number(b.kind === 'auto')
    );
    for (const track of preferred) {
      const cues = await this.deps.captions.cues(track.id);
      if (isErr(cues)) return cues;
      if (cues.value.length === 0) continue;

      const lastEnd = cues.value.reduce((end, cue) => Math.max(end, cue.endMs), 0);
      return ok({
        items: suggestChapters(cues.value, {
          durationMs: video.value.durationMs ?? lastEnd,
          language: track.language ?? track.detectedLanguage,
        }),
      });
    }
    return ok({ items: [] });
  }
}
