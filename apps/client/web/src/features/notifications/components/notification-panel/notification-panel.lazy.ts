import { lazyComponent } from '@vp/ui';
import { createElement } from 'react';
import { NotificationCentreSkeletonRows } from '#app/components/shell/notification-centre';

export const LazyNotificationPanel = lazyComponent(() => import('./notification-panel'), {
  name: 'NotificationPanel',
  pick: (module) => module.NotificationPanel,
  fallback: createElement(NotificationCentreSkeletonRows),
});
