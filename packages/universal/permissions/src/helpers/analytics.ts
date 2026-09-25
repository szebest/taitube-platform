import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { AnalyticsResource, UserContext } from '../types/index';

export function canReadAnalytics({
  user,
  analytics,
}: {
  user: UserContext | null;
  analytics: AnalyticsResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('Analytics', { ...analytics }));
}
