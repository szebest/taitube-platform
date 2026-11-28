import { lazyComponent } from '@kit/ui';

export const LazyShareLinksDialog = lazyComponent(() => import('./share-links-dialog'), {
  name: 'ShareLinksDialog',
  pick: (module) => module.ShareLinksDialog,
});
