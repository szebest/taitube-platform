import { lazyComponent } from '@kit/ui';

export const LazyModerationDialog = lazyComponent(() => import('./moderation-dialog'), {
  name: 'ModerationDialog',
  pick: (module) => module.ModerationDialog,
});
