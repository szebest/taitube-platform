import { type Result, isErr, ok } from '@kit/result';
import type {
  VideoChapterRepository,
  VideoRepository,
  VideoViewRepositoryPort,
} from '@vp/core/repositories';
import { type ClipSuggestion, suggestClips } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface ClipSuggestionServiceDeps {
  videos: VideoRepository;
  views: Pick<VideoViewRepositoryPort, 'retentionCurve'>;
  chapters: VideoChapterRepository;
}

/** Windows worth clipping, read off the retention curve of the generation playing; nothing is stored. */
export class ClipSuggestionService {
  constructor(private readonly deps: ClipSuggestionServiceDeps) {}

  async suggest(
    user: UserContext,
    videoId: string
  ): Promise<Result<{ items: ClipSuggestion[] }, EditAccessFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const curve = await this.deps.views.retentionCurve(videoId);
    if (isErr(curve)) return curve;
    const chapters = await this.deps.chapters.listFor([videoId]);
    if (isErr(chapters)) return chapters;
    return ok({
      items: suggestClips({
        curve: curve.value,
        durationMs: video.value.durationMs ?? 0,
        chapters: chapters.value.get(videoId) ?? [],
      }),
    });
  }
}
