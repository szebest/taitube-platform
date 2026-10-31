import {
  canCreateRecommendationFeedback,
  canDeleteRecommendationFeedback,
  canReadRecommendationFeedback,
  type UserContext,
} from '@vp/permissions';
import type { Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';

const CAN = {
  read: canReadRecommendationFeedback,
  create: canCreateRecommendationFeedback,
  delete: canDeleteRecommendationFeedback,
} as const;

export interface RecommendationFeedbackAccessInput {
  readonly actor: UserContext | null;
  readonly ownerId: string;
  readonly action: keyof typeof CAN;
}

export function decideRecommendationFeedbackAccess({
  actor,
  ownerId,
  action,
}: RecommendationFeedbackAccessInput): Result<UserContext, AuthorizationFailure> {
  return authorize(actor, CAN[action]({ user: actor, feedback: { ownerId } }), {
    action,
    subject: 'RecommendationFeedback',
  });
}
