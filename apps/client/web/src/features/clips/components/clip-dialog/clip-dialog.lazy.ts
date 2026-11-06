import { lazyComponent } from '@vp/ui';

export const LazyClipDialog = lazyComponent(() => import('./clip-dialog'), {
  name: 'ClipDialog',
  pick: (module) => module.ClipDialog,
});
