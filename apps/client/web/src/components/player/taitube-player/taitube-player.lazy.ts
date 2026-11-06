import { lazyComponent } from '@vp/ui';

export const LazyTaitubePlayer = lazyComponent(() => import('./taitube-player'), {
  name: 'TaitubePlayer',
  pick: (module) => module.TaitubePlayer,
  fallback: false,
});
