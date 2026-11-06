import { lazyComponent } from '@vp/ui';

export const LazyTaitubePreview = lazyComponent(
  () => import('./taitube-preview').then((module) => ({ default: module.TaitubePreview })),
  { name: 'TaitubePreview', fallback: false }
);
