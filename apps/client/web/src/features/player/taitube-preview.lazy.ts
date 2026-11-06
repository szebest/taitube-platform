import { lazyComponent } from '@vp/ui';

export const LazyTaitubePreview = lazyComponent(() => import('./taitube-preview'), {
  name: 'TaitubePreview',
  pick: (module) => module.TaitubePreview,
  fallback: false,
});
