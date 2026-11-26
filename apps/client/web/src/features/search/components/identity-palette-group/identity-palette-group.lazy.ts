import { lazyComponent } from '@kit/ui';

export const LazyIdentityPaletteGroup = lazyComponent(() => import('./identity-palette-group'), {
  name: 'IdentityPaletteGroup',
  pick: (module) => module.IdentityPaletteGroup,
});
