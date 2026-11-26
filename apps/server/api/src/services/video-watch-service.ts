import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { ViewBufferPort } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import { type ShareLink, viewBucketsOf } from '@vp/domain';
import { videoNotFound } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import type { ExperimentOverlay } from './experiment-overlay';
import type { GatedReadFailure, VideoAccess, VideoAccessGate } from './video-access-gate';
import type { VideoService } from './video-service';
import type { VideoDetailView } from './video-views';

export interface VideoWatchServiceDeps {
  videos: VideoRepository;
  videoService: VideoService;
  gate: VideoAccessGate;
  experiments: ExperimentOverlay;
  viewBuffer: ViewBufferPort;
  now: () => number;
}

export interface WatchRequest extends VideoAccess {
  /** The tab's ephemeral session key, which picks its test variants and keys its share link open. */
  readonly sessionKey: string | null;
}

export type WatchFailure = GatedReadFailure;

/**
 * The read behind the watch page, the embed and the playback information: the access gate, the
 * share link open it counts, and the session's test variant over the title and thumbnail.
 */
export class VideoWatchService {
  constructor(private readonly deps: VideoWatchServiceDeps) {}

  async watch(
    viewer: UserContext | null,
    videoId: string,
    request: WatchRequest
  ): Promise<Result<VideoDetailView, WatchFailure>> {
    const found = await this.deps.videos.findWithDetails(videoId);
    if (isErr(found)) return found;

    const gated = await this.deps.gate.read(viewer, found.value?.video ?? null, videoId, request);
    if (isErr(gated)) return gated;
    if (!found.value) return err(videoNotFound(videoId));

    const view = await this.deps.videoService.detail(found.value);
    if (isErr(view)) return view;

    const { link } = gated.value;
    const viewerKey = viewer?.id ?? request.sessionKey;
    if (link && viewerKey !== null) await this.recordOpen(link, viewerKey);
    const shown = link ? { ...view.value, shareLinkId: link.id } : view.value;
    return ok(await this.deps.experiments.applyOne(shown, request.sessionKey));
  }

  /**
   * One open per viewer, link and day. A read with neither an account nor a session key counts
   * nothing: the server render has no key, and the browser's own read after hydration carries it.
   */
  private async recordOpen(link: ShareLink, viewerKey: string): Promise<void> {
    const { viewDate } = viewBucketsOf(new Date(this.deps.now()));
    ignore(
      await this.deps.viewBuffer.recordShareLinkOpen({
        videoId: link.targetId,
        linkId: link.id,
        viewerKey,
        viewDate,
      }),
      'an open the buffer could not take is a gap in a statistic, never a refused read'
    );
  }
}
