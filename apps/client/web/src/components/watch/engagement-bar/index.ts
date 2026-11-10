import {
  EngagementBarAction,
  EngagementBarActions,
  EngagementBarChannel,
  EngagementBarOverflow,
  EngagementBarReaction,
  EngagementBarRoot,
} from './engagement-bar';

export const EngagementBar = {
  Root: EngagementBarRoot,
  Channel: EngagementBarChannel,
  Actions: EngagementBarActions,
  Reaction: EngagementBarReaction,
  Action: EngagementBarAction,
  Overflow: EngagementBarOverflow,
};

export { EngagementBarSkeleton, RollingCount } from './engagement-bar';

export { useEngagementBar } from './engagement-bar.context';
export { engagementBarStyles } from './engagement-bar.variants';
export type { EngagementBarReaction } from './types';
