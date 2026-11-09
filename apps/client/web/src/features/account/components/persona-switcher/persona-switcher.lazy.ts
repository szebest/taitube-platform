import { lazyComponent } from '@vp/ui';

// The flag is compared here, not read from `lib/config`, or Rolldown cannot drop the import of a build that leaves it off.
export const LazyPersonaSwitcher =
  import.meta.env.VITE_DEMO_PERSONAS === 'true'
    ? lazyComponent(() => import('@vp/queries/demo-personas'), {
        name: 'PersonaSwitcher',
        pick: (module) => module.PersonaSwitcher,
        fallback: false,
      })
    : undefined;
