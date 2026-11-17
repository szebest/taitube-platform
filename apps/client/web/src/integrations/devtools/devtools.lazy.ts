import { lazyComponent } from '@kit/ui';

export const LazyDevtools = import.meta.env.DEV
  ? lazyComponent(() => import('./devtools'), {
      name: 'Devtools',
      pick: (module) => module.default,
      fallback: false,
    })
  : () => null;
