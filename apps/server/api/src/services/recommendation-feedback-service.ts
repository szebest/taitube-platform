import type {
  RecommendationFeedbackBody,
  RecommendationFeedbackItemView,
  RecommendationFeedbackView,
} from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  RecommendationFeedbackRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import type { FeedbackTarget, RecommendationFeedbackKind } from '@vp/domain';
import {
  type AuthorizationFailure,
  type RecommendationFeedbackNotFound,
  type RecommendationFeedbackTargetFailure,
  decideRecommendationFeedbackAccess,
  decideRecommendationFeedbackRemoval,
  decideRecommendationFeedbackTarget,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, isErr, map } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import type { HomeService } from './home-service';
import {
  toRecommendationFeedbackItemView,
  toRecommendationFeedbackView,
} from './recommendation-feedback-views';
import type { SpriteGeometry } from './video-views';

export interface RecommendationFeedbackServiceDeps {
  feedback: RecommendationFeedbackRepositoryPort;
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  home: Pick<HomeService, 'forget'>;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  now: () => number;
}

interface RecommendationFeedbackPage {
  items: RecommendationFeedbackItemView[];
  nextCursor: string | null;
}

/**
 * "Not this" and "never this channel", in the caller's own rows. It is an explicit act, so it is
 * stored whether or not the viewer paused their history, and every write drops their cached home page.
 */
export class RecommendationFeedbackService {
  constructor(private readonly deps: RecommendationFeedbackServiceDeps) {}

  async put(
    viewer: UserContext,
    body: RecommendationFeedbackBody
  ): Promise<
    Result<
      RecommendationFeedbackView,
      AuthorizationFailure | RecommendationFeedbackTargetFailure | DatabaseUnavailable
    >
  > {
    const allowed = decideRecommendationFeedbackAccess({
      actor: viewer,
      ownerId: viewer.id,
      action: 'create',
    });
    if (isErr(allowed)) return allowed;

    const target = await this.target(viewer, body);
    if (isErr(target)) return target;

    const stored = await this.deps.feedback.put({
      ...target.value,
      id: uuidv7(),
      userId: viewer.id,
      createdAt: new Date(this.deps.now()),
    });
    if (isErr(stored)) return stored;

    await this.deps.home.forget(viewer.id);
    return map(stored, toRecommendationFeedbackView);
  }

  async remove(
    viewer: UserContext,
    feedbackId: string
  ): Promise<
    Result<void, AuthorizationFailure | RecommendationFeedbackNotFound | DatabaseUnavailable>
  > {
    const allowed = decideRecommendationFeedbackAccess({
      actor: viewer,
      ownerId: viewer.id,
      action: 'delete',
    });
    if (isErr(allowed)) return allowed;

    const removed = await this.deps.feedback.remove(viewer.id, feedbackId);
    if (isErr(removed)) return removed;

    if (removed.value) await this.deps.home.forget(viewer.id);
    return decideRecommendationFeedbackRemoval({ feedbackId, removed: removed.value });
  }

  async list(
    viewer: UserContext,
    query: { cursor?: string; limit?: number; kind?: RecommendationFeedbackKind }
  ): Promise<
    Result<RecommendationFeedbackPage, AuthorizationFailure | DatabaseUnavailable | InvalidCursor>
  > {
    const allowed = decideRecommendationFeedbackAccess({
      actor: viewer,
      ownerId: viewer.id,
      action: 'read',
    });
    if (isErr(allowed)) return allowed;

    const { paginator, cdn, sprite } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.feedback.list(viewer, {
      kind: query.kind ?? null,
      cursor: cursor.value && { createdAt: cursor.value.createdAt, id: cursor.value.id },
      limit,
    });
    return map(rows, (entries) =>
      paginator.paginate(entries, limit, {
        cursorOf: ({ createdAt, id }) => createdAtCursorPayload({ createdAt, id }),
        toItem: (entry) => toRecommendationFeedbackItemView(entry, cdn, sprite),
      })
    );
  }

  private async target(
    viewer: UserContext,
    target: RecommendationFeedbackBody
  ): Promise<Result<FeedbackTarget, RecommendationFeedbackTargetFailure | DatabaseUnavailable>> {
    const { videos, channels } = this.deps;
    if (target.kind === 'not_interested') {
      const video = await videos.findById(target.videoId);
      return andThen(video, (found) =>
        decideRecommendationFeedbackTarget({ viewer, target, video: found, channel: null })
      );
    }
    const channel = await channels.findById(target.channelId);
    return andThen(channel, (found) =>
      decideRecommendationFeedbackTarget({ viewer, target, video: null, channel: found })
    );
  }
}
