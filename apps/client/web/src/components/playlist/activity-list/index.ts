import {
  ActivityListAction,
  ActivityListAvatar,
  ActivityListItem,
  ActivityListRoot,
  ActivityListText,
  ActivityListTime,
} from './activity-list';

export const ActivityList = {
  Root: ActivityListRoot,
  Item: ActivityListItem,
  Avatar: ActivityListAvatar,
  Text: ActivityListText,
  Time: ActivityListTime,
  Action: ActivityListAction,
};

export type { ActivityListAvatarProps, ActivityListTimeProps } from './activity-list';
export { ActivityListSkeleton } from './components/activity-list-skeleton/activity-list-skeleton';
