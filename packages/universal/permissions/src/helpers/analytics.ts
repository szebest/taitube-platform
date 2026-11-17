import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { AnalyticsResource, UserContext, VideoStatsResource } from '../types/index';

export function canReadAnalytics({
  user,
  analytics,
}: {
  user: UserContext | null;
  analytics: AnalyticsResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('Analytics', { ...analytics }));
}

export function canReadVideoStats({
  user,
  video,
}: {
  user: UserContext | null;
  video: VideoStatsResource;
}): boolean {
  return getUserPermissions(user).can('read', subject('VideoStats', { ...video }));
}
