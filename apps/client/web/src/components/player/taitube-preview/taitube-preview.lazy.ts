import { lazyComponent } from '@kit/ui';

export const LazyTaitubePreview = lazyComponent(() => import('./taitube-preview'), {
  name: 'TaitubePreview',
  pick: (module) => module.TaitubePreview,
  fallback: false,
});
