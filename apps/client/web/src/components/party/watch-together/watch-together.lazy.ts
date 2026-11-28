import { lazyComponent } from '@kit/ui';

export const LazyWatchTogetherContent = lazyComponent(
  () => import('./components/watch-together-content/watch-together-content'),
  { name: 'WatchTogetherContent', pick: (module) => module.WatchTogetherContent }
);
