import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { NotificationResource, UserContext } from '../types/index';

interface NotificationCheck {
  user: UserContext | null;
  notification: NotificationResource;
}

export function canReadNotification({ user, notification }: NotificationCheck): boolean {
  return getUserPermissions(user).can('read', subject('Notification', { ...notification }));
}

export function canUpdateNotification({ user, notification }: NotificationCheck): boolean {
  return getUserPermissions(user).can('update', subject('Notification', { ...notification }));
}
