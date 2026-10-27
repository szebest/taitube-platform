import { createCompoundContext } from '@vp/ui';
import type { NotificationCentreLayout } from './types';

export const [NotificationCentreContext, useNotificationCentre] = createCompoundContext<{
  layout: NotificationCentreLayout;
  open: boolean;
  setOpen: (open: boolean) => void;
  unread: string | undefined;
  titleId: string;
}>('NotificationCentre');
