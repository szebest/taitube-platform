import { lazyComponent } from '@kit/ui';

export const LazyStudioIdentitySwitcherSheet = lazyComponent(
  () => import('./studio-identity-switcher-sheet'),
  { name: 'StudioIdentitySwitcherSheet', pick: (module) => module.StudioIdentitySwitcherSheet }
);
