import { lazyComponent } from '@vp/ui';

export const LazyGlobalNowPlayingBar = lazyComponent(() => import('./global-now-playing-bar'), {
  name: 'GlobalNowPlayingBar',
  pick: (module) => module.GlobalNowPlayingBar,
});
