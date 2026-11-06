import { lazyComponent } from '@vp/ui';

export const LazyRetentionPlot = lazyComponent(
  () => import('./retention-plot').then((module) => ({ default: module.RetentionPlot })),
  { name: 'RetentionPlot', fallback: false }
);
