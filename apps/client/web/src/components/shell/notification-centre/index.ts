import {
  NotificationCentreBody,
  NotificationCentreFilters,
  NotificationCentreGroup,
  NotificationCentreHeader,
  NotificationCentreItem,
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
  Item: NotificationCentreItem,
};

export { NotificationCentreSkeleton } from './notification-centre';

export { useNotificationCentre } from './notification-centre.context';
export { notificationCentreStyles } from './notification-centre.variants';
