import { lazyComponent } from '@vp/ui';

export const LazyLiveViewersPlot = lazyComponent(
  () => import('./live-viewers-plot').then((module) => ({ default: module.LiveViewersPlot })),
  { name: 'LiveViewersPlot', fallback: false }
);
