import type { InvalidCursor, Paginator } from '@kit/pagination';
import { andThen, andThenAsync, err, isErr, map, type Result } from '@kit/result';
import type { ClipPageView, ClipView, CreateClipBody } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  ClipRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import { type ChannelCard, type Clip, toChannelCard, type Video } from '@vp/domain';
import {
  type ClipNotFound,
  type CreateClipFailure,
  clipNotFound,
  type DeleteClipFailure,
  decideClipCreate,
  decideClipDelete,
  decideClipRead,
  decideVideoRead,
  publicReadFailure,
  videoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import { NO_VIDEO_ACCESS, type VideoAccessGate } from './video-access-gate';
import { type SpriteGeometry, toVideoSummaryView } from './video-views';

export interface ClipServiceDeps {
  clips: ClipRepositoryPort;
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  gate: VideoAccessGate;
  now: () => number;
}

interface ListClipsQuery {
  cursor?: string;
  limit?: number;
}

/** A clip is a reference to a range of a video: it is readable exactly when its video is. */
export class ClipService {
  constructor(private readonly deps: ClipServiceDeps) {}

  async create(
    viewer: UserContext | null,
    videoId: string,
    body: CreateClipBody
  ): Promise<Result<ClipView, CreateClipFailure | DatabaseUnavailable>> {
    const found = await this.deps.videos.findById(videoId);
    return andThenAsync(found, async (video) => {
      if (!video) return err(videoNotFound(videoId));
      const readable = decideVideoRead({ viewer, video, videoId });
      if (isErr(readable)) return err(publicReadFailure(readable.error));
      const decided = decideClipCreate({ viewer, video, videoId, ...body });
      return andThenAsync(decided, async (toCreate) => {
        const clip: Clip = { ...toCreate, id: uuidv7(), createdAt: new Date(this.deps.now()) };
        const stored = await this.deps.clips.create(clip);
        return andThenAsync(stored, () => this.present(clip, video));
      });
    });
  }

  /**
   * A clip of a password-protected video opens with that video's unlock credential, which
   * `unlockOf` finds among the caller's cookies once the clip names its video.
   */
  async get(
    viewer: UserContext | null,
    clipId: string,
    unlockOf: (videoId: string) => string | null
  ): Promise<Result<ClipView, ClipNotFound | DatabaseUnavailable>> {
    const found = await this.deps.clips.findById(clipId);
    if (isErr(found)) return found;
    const clip = found.value;
    if (!clip) return err(clipNotFound(clipId));

    const loaded = await this.deps.videos.findById(clip.videoId);
    if (isErr(loaded)) return loaded;
    const video = loaded.value;
    const decided = decideClipRead({ viewer, clip, video, clipId });
    if (isErr(decided) || !video) return err(clipNotFound(clipId));

    const access = { ...NO_VIDEO_ACCESS, credential: unlockOf(video.id) };
    const gated = await this.deps.gate.read(viewer, video, video.id, access);
    if (isErr(gated)) {
      return gated.error.code === ErrorCodes.DATABASE_UNAVAILABLE
        ? err(gated.error)
        : err(clipNotFound(clipId));
    }
    return this.present(decided.value, gated.value.video);
  }

  async listMine(
    viewer: UserContext,
    query: ListClipsQuery
  ): Promise<Result<ClipPageView, DatabaseUnavailable | InvalidCursor>> {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.clips.listByCreator(viewer, { cursor: cursor.value, limit });
    return map(rows, (entries) =>
      paginator.paginate(entries, limit, {
        cursorOf: ({ clip }) => createdAtCursorPayload(clip),
        toItem: ({ clip, video, channel }) => this.toView(clip, video, channel),
      })
    );
  }

  async remove(
    actor: UserContext | null,
    clipId: string
  ): Promise<Result<void, DeleteClipFailure | DatabaseUnavailable>> {
    const found = await this.deps.clips.findById(clipId);
    const decided = andThen(found, (clip) => decideClipDelete({ actor, clip, clipId }));
    return andThenAsync(decided, async ({ id }) =>
      map(await this.deps.clips.remove(id), () => undefined)
    );
  }

  private async present(clip: Clip, video: Video): Promise<Result<ClipView, DatabaseUnavailable>> {
    const owner = await this.deps.channels.findById(video.channelId);
    return map(owner, (channel) => this.toView(clip, video, channel && toChannelCard(channel)));
  }

  private toView(clip: Clip, video: Video, channel: ChannelCard | null): ClipView {
    const { deps } = this;
    return {
      ...clip,
      createdAt: clip.createdAt.toISOString(),
      video: toVideoSummaryView(video, deps.cdn, deps.sprite, channel),
    };
  }
}
