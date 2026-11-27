import { lazyComponent } from '@kit/ui';

export const LazyWatchThreadPanel = lazyComponent(() => import('./watch-thread-panel'), {
  name: 'WatchThreadPanel',
  pick: (module) => module.WatchThreadPanel,
});
