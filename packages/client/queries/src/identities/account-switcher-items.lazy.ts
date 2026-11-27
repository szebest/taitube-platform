import { lazyComponent } from '@kit/ui';

export const LazyAccountSwitcherItems = lazyComponent(() => import('./account-switcher-items'), {
  name: 'AccountSwitcherItems',
  pick: (module) => module.AccountSwitcherItems,
});
