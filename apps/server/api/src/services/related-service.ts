import { type Result, isErr, map, ok } from '@kit/result';
import type { ReasonedVideo } from '@vp/api-contracts';
import type {
  RecommendationFeedbackRepositoryPort,
  RelatedVideosRepositoryPort,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { RELATED_LIMIT, relatedReasonOf, withoutHidden } from '@vp/domain';
import { decideVideoRead } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { ExperimentOverlay } from './experiment-overlay';
import type { ReadVideoServiceFailure, VideoService } from './video-service';
import type { ViewerProgress } from './viewer-progress';

export interface RelatedServiceDeps {
  videos: VideoRepository;
  related: RelatedVideosRepositoryPort;
  feedback: RecommendationFeedbackRepositoryPort;
  videoService: VideoService;
  viewerProgress: ViewerProgress;
  experiments: ExperimentOverlay;
}

export class RelatedService {
  constructor(private readonly deps: RelatedServiceDeps) {}

  async get(
    viewer: UserContext | null,
    videoId: string,
    sessionKey: string | null = null
  ): Promise<Result<ReasonedVideo[], ReadVideoServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoRead({ viewer, video: found.value, videoId });
    if (isErr(decided)) return decided;

    const items = await this.of(decided.value, viewer);
    if (isErr(items)) return items;

    const shown = await this.withoutHidden(viewer, items.value);
    if (isErr(shown)) return shown;

    const marked = await this.deps.viewerProgress.attach(viewer, shown.value);
    return ok(await this.deps.experiments.apply(marked, sessionKey));
  }

  /** The reasoned videos around `video`, without the caller's progress on them. */
  async of(
    video: VideoRecord,
    viewer: UserContext | null
  ): Promise<Result<ReasonedVideo[], DatabaseUnavailable>> {
    const found = await this.deps.related.find({
      videoId: video.id,
      ownerId: video.ownerId,
      categoryId: video.categoryId ?? null,
      tags: video.tags ?? [],
      excludeOwnerId: viewer?.id ?? null,
      limit: RELATED_LIMIT,
    });
    if (isErr(found)) return found;

    const summaries = await this.deps.videoService.summarize(found.value.map((hit) => hit.video));
    return map(summaries, (items) =>
      found.value.flatMap(({ signals }, index) => {
        const item = items[index];
        const kind = relatedReasonOf(signals);
        return item && kind ? [{ ...item, reason: { kind, subjectId: video.id } }] : [];
      })
    );
  }

  private async withoutHidden(
    viewer: UserContext | null,
    items: ReasonedVideo[]
  ): Promise<Result<ReasonedVideo[], DatabaseUnavailable>> {
    if (!viewer) return ok(items);

    const hidden = await this.deps.feedback.hiddenOf(viewer.id);
    return map(hidden, (found) => withoutHidden(items, found));
  }
}
