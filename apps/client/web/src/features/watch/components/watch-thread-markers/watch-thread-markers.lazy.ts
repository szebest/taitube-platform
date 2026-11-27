import { lazyComponent } from '@kit/ui';

export const LazyWatchThreadMarkers = lazyComponent(() => import('./watch-thread-markers'), {
  name: 'WatchThreadMarkers',
  pick: (module) => module.WatchThreadMarkers,
});
