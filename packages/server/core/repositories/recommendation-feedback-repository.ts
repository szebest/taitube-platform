import type {
  HiddenFeedback,
  NewRecommendationFeedback,
  RecommendationFeedback,
  RecommendationFeedbackEntry,
  RecommendationFeedbackKind,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

interface RecommendationFeedbackCursor {
  createdAt: Date;
  id: string;
}

export interface ListRecommendationFeedbackOptions {
  kind: RecommendationFeedbackKind | null;
  cursor: RecommendationFeedbackCursor | null;
  limit: number;
}

/**
 * One row per user and target. Putting a target the user already marked answers the row that is
 * there, and putting a new one keeps the user's newest `RECOMMENDATION_FEEDBACK_LIMIT` rows, in one
 * statement. Every read and delete is keyed by the caller's id, so another user's row is never
 * reachable.
 */
export interface RecommendationFeedbackRepositoryPort {
  put(
    entry: NewRecommendationFeedback
  ): Promise<Result<RecommendationFeedback, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows; a video the viewer may no longer watch comes back as `null`. */
  list(
    viewer: UserContext,
    options: ListRecommendationFeedbackOptions
  ): Promise<Result<RecommendationFeedbackEntry[], DatabaseUnavailable>>;
  /** Every video and channel the user hid, in one read. */
  hiddenOf(userId: string): Promise<Result<HiddenFeedback, DatabaseUnavailable>>;
  remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>>;
}
