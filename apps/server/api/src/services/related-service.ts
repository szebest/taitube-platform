import type { ReasonedVideo } from '@vp/api-contracts';
import type {
  RelatedVideosRepositoryPort,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { RELATED_LIMIT, relatedReasonOf } from '@vp/domain';
import { decideVideoRead } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { isErr, map, ok, type Result } from '@vp/result';
import type { ReadVideoServiceFailure, VideoService } from './video-service';
import type { ViewerProgress } from './viewer-progress';

export interface RelatedServiceDeps {
  videos: VideoRepository;
  related: RelatedVideosRepositoryPort;
  videoService: VideoService;
  viewerProgress: ViewerProgress;
}

export class RelatedService {
  constructor(private readonly deps: RelatedServiceDeps) {}

  async get(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<ReasonedVideo[], ReadVideoServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideVideoRead({ viewer, video: found.value, videoId });
    if (isErr(decided)) return decided;

    const items = await this.of(decided.value, viewer);
    if (isErr(items)) return items;

    return ok(await this.deps.viewerProgress.attach(viewer, items.value));
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
}
