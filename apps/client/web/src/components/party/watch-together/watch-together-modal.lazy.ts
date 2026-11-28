import { lazyComponent } from '@kit/ui';

export const LazyWatchTogetherModal = lazyComponent(() => import('./watch-together-modal'), {
  name: 'WatchTogetherModal',
  pick: (module) => module.WatchTogetherModal,
});
