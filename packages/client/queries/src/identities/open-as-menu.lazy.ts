import { lazyComponent } from '@kit/ui';

export const LazyOpenAsMenu = lazyComponent(() => import('./open-as-menu'), {
  name: 'OpenAsMenu',
  pick: (module) => module.OpenAsMenu,
});
