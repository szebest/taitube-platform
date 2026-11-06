import { lazyComponent } from '@vp/ui';

export const LazyTaitubePlayer = lazyComponent(
  () => import('./taitube-player').then((module) => ({ default: module.TaitubePlayer })),
  { name: 'TaitubePlayer', fallback: false }
);
