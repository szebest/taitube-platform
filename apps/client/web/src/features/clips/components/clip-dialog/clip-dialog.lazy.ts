import { lazyComponent } from '@kit/ui';

export const LazyClipDialog = lazyComponent(() => import('./clip-dialog'), {
  name: 'ClipDialog',
  pick: (module) => module.ClipDialog,
});
