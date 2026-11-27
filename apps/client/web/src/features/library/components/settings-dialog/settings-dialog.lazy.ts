import { lazyComponent } from '@kit/ui';

export const LazySettingsDialog = lazyComponent(() => import('./settings-dialog'), {
  name: 'SettingsDialog',
  pick: (module) => module.SettingsDialog,
});
