import { lazyComponent } from '@kit/ui';

export const LazyIdentitySwitcherSheet = lazyComponent(() => import('./identity-switcher-sheet'), {
  name: 'IdentitySwitcherSheet',
  pick: (module) => module.IdentitySwitcherSheet,
});
