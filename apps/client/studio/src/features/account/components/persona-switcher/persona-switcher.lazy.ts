import { lazyComponent } from '@vp/ui';

export const LazyPersonaSwitcher = import.meta.env.DEV
  ? lazyComponent(() => import('@vp/queries/dev-personas'), {
      name: 'PersonaSwitcher',
      pick: (module) => module.PersonaSwitcher,
      fallback: false,
    })
  : undefined;
