import { lazyComponent } from '@vp/ui';

export const LazyDevtools = import.meta.env.DEV
  ? lazyComponent(() => import('./devtools'), {
      name: 'Devtools',
      pick: (module) => module.default,
      fallback: false,
    })
  : () => null;
