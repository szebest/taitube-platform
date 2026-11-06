import { lazyComponent } from '@vp/ui';

export const LazyViewsPlot = lazyComponent(
  () => import('./views-plot').then((module) => ({ default: module.ViewsPlot })),
  { name: 'ViewsPlot', fallback: false }
);
