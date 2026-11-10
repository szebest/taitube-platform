import type {
  CreatorScreeningView,
  ScreeningCaseView,
  ScreeningDecisionView,
} from '@vp/api-contracts';
import type { JobQueue } from '@vp/core/ports';
import type {
  ScreeningAppealRecord,
  ScreeningRepository,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { creatorScreeningReasons } from '@vp/domain';
import {
  type AppealScreeningFailure,
  type AuthorizationFailure,
  type OwnScreeningFailure,
  type ReviewScreeningFailure,
  type ScreeningAction,
  decideScreeningAppeal,
  decideScreeningQueueAccess,
  decideScreeningRead,
  decideScreeningReview,
} from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type VersionConflict,
  versionConflict,
} from '@vp/errors';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, isOk, map, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { ScreeningCaseViewFailure, ScreeningCaseViews } from './screening-case-views';
import { decodeScreeningCaseCursor, screeningCaseCursorPayload } from './screening-cursor';
import { buildApprovedPackageDispatch, enqueueApprovedPackage } from './screening-package';

export interface ScreeningServiceDeps {
  screenings: ScreeningRepository;
  videos: VideoRepository;
  views: ScreeningCaseViews;
  packageQueue: JobQueue;
  paginator: Paginator;
}

export type ScreeningQueueFailure = AuthorizationFailure | InvalidCursor | ScreeningCaseViewFailure;

export type ScreeningReviewFailure = ReviewScreeningFailure | VersionConflict | DatabaseUnavailable;

export type OwnScreeningServiceFailure = OwnScreeningFailure | DatabaseUnavailable;
export type AppealScreeningServiceFailure =
  | AppealScreeningFailure
  | VersionConflict
  | DatabaseUnavailable;

export interface ScreeningQueueOptions {
  cursor?: string;
  limit?: number;
  state?: 'open' | 'decided';
}

/**
 * The review of held and flagged videos: the moderator's queue and decisions, and the owner's
 * reading of why a video is held and appeal of a rejection. Every decision is a compare-and-set in the
 * repository, so a stale moderator loses it and is told so.
 */
export class ScreeningService {
  constructor(private readonly deps: ScreeningServiceDeps) {}

  async queue(
    actor: UserContext,
    options: ScreeningQueueOptions
  ): Promise<
    Result<{ items: ScreeningCaseView[]; nextCursor: string | null }, ScreeningQueueFailure>
  > {
    const allowed = decideScreeningQueueAccess(actor);
    if (isErr(allowed)) return allowed;

    const { paginator, screenings, views } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeScreeningCaseCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const found = await screenings.listCases({
      cursor: cursor.value,
      limit,
      state: options.state,
    });
    if (isErr(found)) return found;

    const page = paginator.paginate(found.value, limit, {
      cursorOf: ({ screening }) => screeningCaseCursorPayload(screening),
      toItem: (item) => item,
    });
    return map(await views.toViews(page.items), (items) => ({
      items,
      nextCursor: page.nextCursor,
    }));
  }

  async approve(
    moderator: UserContext,
    videoId: string
  ): Promise<Result<ScreeningDecisionView, ScreeningReviewFailure>> {
    const reviewed = await this.review(moderator, videoId, 'approve');
    if (isErr(reviewed)) return reviewed;
    const { video } = reviewed.value;

    const dispatch = buildApprovedPackageDispatch(
      video,
      getActiveTraceparent() ?? createTraceparent()
    );
    if (!dispatch) return err(versionConflict(videoId));

    const approved = await this.deps.screenings.approve({
      videoId,
      moderatorId: moderator.id,
      outbox: dispatch.outbox,
    });
    if (isErr(approved)) return approved;
    if (!approved.value) return err(versionConflict(videoId));

    await enqueueApprovedPackage(this.deps.packageQueue, dispatch);
    return ok({ videoId, status: 'PROCESSING' });
  }

  async reject(
    moderator: UserContext,
    videoId: string,
    reason: string
  ): Promise<Result<ScreeningDecisionView, ScreeningReviewFailure>> {
    const reviewed = await this.review(moderator, videoId, 'reject');
    if (isErr(reviewed)) return reviewed;

    const rejected = await this.deps.screenings.reject({
      videoId,
      moderatorId: moderator.id,
      reason,
    });
    if (isErr(rejected)) return rejected;
    return rejected.value ? ok({ videoId, status: 'REJECTED' }) : err(versionConflict(videoId));
  }

  async dismiss(
    moderator: UserContext,
    videoId: string
  ): Promise<Result<ScreeningDecisionView, ScreeningReviewFailure>> {
    const reviewed = await this.review(moderator, videoId, 'dismiss');
    if (isErr(reviewed)) return reviewed;

    const dismissed = await this.deps.screenings.dismiss({ videoId, moderatorId: moderator.id });
    if (isErr(dismissed)) return dismissed;
    return dismissed.value
      ? ok({ videoId, status: reviewed.value.video.status })
      : err(versionConflict(videoId));
  }

  async ownScreening(
    owner: UserContext,
    videoId: string
  ): Promise<Result<CreatorScreeningView, OwnScreeningServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideScreeningRead({ actor: owner, video: found.value, videoId });
    if (isErr(decided)) return decided;
    return this.creatorView(owner, decided.value);
  }

  async appeal(
    owner: UserContext,
    videoId: string,
    message: string
  ): Promise<Result<CreatorScreeningView, AppealScreeningServiceFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;

    const decided = decideScreeningAppeal({ actor: owner, video: found.value, videoId });
    if (isErr(decided)) return decided;

    const appealed = await this.deps.screenings.appeal({
      id: uuidv7(),
      videoId,
      authorId: owner.id,
      message,
    });
    if (isErr(appealed)) return appealed;
    if (!appealed.value) return err(versionConflict(videoId));

    const reloaded = await this.deps.videos.findById(videoId);
    if (isErr(reloaded)) return reloaded;
    return reloaded.value ? this.creatorView(owner, reloaded.value) : err(versionConflict(videoId));
  }

  private async review(
    moderator: UserContext,
    videoId: string,
    action: ScreeningAction
  ): Promise<Result<{ video: VideoRecord }, ScreeningReviewFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const appeals = await this.deps.screenings.findAppeals(videoId);
    if (isErr(appeals)) return appeals;

    const decided = decideScreeningReview({
      actor: moderator,
      video: found.value,
      videoId,
      action,
      openAppeal: appeals.value.find(({ resolvedAt }) => resolvedAt === null) ?? null,
    });
    return map(decided, (video) => ({ video }));
  }

  private async creatorView(
    owner: UserContext,
    video: VideoRecord
  ): Promise<Result<CreatorScreeningView, DatabaseUnavailable>> {
    const [latest, appeals] = await Promise.all([
      this.deps.screenings.latestForVideo(video.id),
      this.deps.screenings.findAppeals(video.id),
    ]);
    if (isErr(latest)) return latest;
    if (isErr(appeals)) return appeals;

    const screened = latest.value;
    const rejected =
      video.status === 'REJECTED' && video.errorCode === ErrorCodes.SCREENING_REJECTED;
    const heldOrRejected = video.status === 'HELD' || rejected;
    const appeal = appeals.value[0];

    return ok({
      videoId: video.id,
      status: video.status,
      reasons: heldOrRejected ? creatorScreeningReasons(screened?.reasons ?? []) : [],
      decision: rejected ? 'rejected' : null,
      decisionNote: rejected ? (screened?.decisionNote ?? null) : null,
      canAppeal: isOk(decideScreeningAppeal({ actor: owner, video, videoId: video.id })),
      appeal: appeal ? appealView(appeal) : null,
    });
  }
}

function appealView(appeal: ScreeningAppealRecord): NonNullable<CreatorScreeningView['appeal']> {
  return {
    message: appeal.message,
    createdAt: appeal.createdAt.toISOString(),
    resolved: appeal.resolvedAt !== null,
  };
}
