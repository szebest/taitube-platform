import { lazyComponent } from '@vp/ui';

export const LazyViewsPlot = lazyComponent(() => import('./views-plot'), {
  name: 'ViewsPlot',
  pick: (module) => module.ViewsPlot,
  fallback: false,
});
