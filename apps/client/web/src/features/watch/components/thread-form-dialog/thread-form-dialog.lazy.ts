import { lazyComponent } from '@kit/ui';

export const LazyThreadFormDialog = lazyComponent(() => import('./thread-form-dialog'), {
  name: 'ThreadFormDialog',
  pick: (module) => module.ThreadFormDialog,
});
