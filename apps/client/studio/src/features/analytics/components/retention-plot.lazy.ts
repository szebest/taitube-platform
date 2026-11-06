import { lazyComponent } from '@vp/ui';

export const LazyRetentionPlot = lazyComponent(() => import('./retention-plot'), {
  name: 'RetentionPlot',
  pick: (module) => module.RetentionPlot,
  fallback: false,
});
