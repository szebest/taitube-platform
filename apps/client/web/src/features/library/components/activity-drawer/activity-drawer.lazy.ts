import { lazyComponent } from '@kit/ui';

export const LazyActivityDrawer = lazyComponent(() => import('./activity-drawer'), {
  name: 'ActivityDrawer',
  pick: (module) => module.ActivityDrawer,
});
