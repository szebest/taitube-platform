import { lazyComponent } from '@vp/ui';

export const LazyClipDialog = lazyComponent(
  () => import('./clip-dialog').then((module) => ({ default: module.ClipDialog })),
  { name: 'ClipDialog' }
);
