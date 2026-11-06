import { lazyComponent } from '@vp/ui';

export const LazyPersonaSwitcher = import.meta.env.DEV
  ? lazyComponent(
      () =>
        import('@vp/queries/dev-personas').then((module) => ({ default: module.PersonaSwitcher })),
      { name: 'PersonaSwitcher', fallback: false }
    )
  : undefined;
