import {
  NotificationCentreBody,
  NotificationCentreCta,
  NotificationCentreFilters,
  NotificationCentreGroup,
  NotificationCentreHeader,
  NotificationCentreItem,
  NotificationCentreItemAction,
  NotificationCentreMarkAllRead,
  NotificationCentreNotice,
  NotificationCentrePanel,
  NotificationCentreRoot,
  NotificationCentreTrigger,
} from './notification-centre';

export const NotificationCentre = {
  Root: NotificationCentreRoot,
  Trigger: NotificationCentreTrigger,
  Panel: NotificationCentrePanel,
  Header: NotificationCentreHeader,
  MarkAllRead: NotificationCentreMarkAllRead,
  Filters: NotificationCentreFilters,
  Notice: NotificationCentreNotice,
  Body: NotificationCentreBody,
  Group: NotificationCentreGroup,
  Cta: NotificationCentreCta,
  Item: NotificationCentreItem,
  ItemAction: NotificationCentreItemAction,
};

export {
  NotificationCentreSkeleton,
  NotificationCentreSkeletonRows,
} from './notification-centre-skeleton';

export { useNotificationCentre } from './notification-centre.context';
export { notificationCentreStyles } from './notification-centre.variants';
