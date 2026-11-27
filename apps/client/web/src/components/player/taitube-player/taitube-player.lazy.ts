import { lazyComponent } from '@kit/ui';

export const LazyTaitubePlayer = lazyComponent(() => import('./taitube-player'), {
  name: 'TaitubePlayer',
  pick: (module) => module.TaitubePlayer,
  fallback: false,
});
