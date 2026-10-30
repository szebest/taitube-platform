import { dt } from '../define';

export const notifications = {
  emptyTitle: dt('No notifications yet'),
  emptyDescription: dt(
    'New uploads from channels you follow and replies to your comments will land here.'
  ),
  manageSubscriptions: dt('Manage subscriptions'),
} as const;
