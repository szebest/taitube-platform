import { lazyComponent } from '@kit/ui';

export const LazyRulesDialog = lazyComponent(() => import('./rules-dialog'), {
  name: 'RulesDialog',
  pick: (module) => module.RulesDialog,
});
