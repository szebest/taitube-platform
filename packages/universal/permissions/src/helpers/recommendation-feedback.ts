import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { RecommendationFeedbackResource, UserContext } from '../types/index';

interface RecommendationFeedbackCheck {
  user: UserContext | null;
  feedback: RecommendationFeedbackResource;
}

export function canReadRecommendationFeedback({
  user,
  feedback,
}: RecommendationFeedbackCheck): boolean {
  return getUserPermissions(user).can('read', subject('RecommendationFeedback', { ...feedback }));
}

export function canCreateRecommendationFeedback({
  user,
  feedback,
}: RecommendationFeedbackCheck): boolean {
  return getUserPermissions(user).can('create', subject('RecommendationFeedback', { ...feedback }));
}

export function canDeleteRecommendationFeedback({
  user,
  feedback,
}: RecommendationFeedbackCheck): boolean {
  return getUserPermissions(user).can('delete', subject('RecommendationFeedback', { ...feedback }));
}
