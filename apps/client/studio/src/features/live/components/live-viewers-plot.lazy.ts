import { lazyComponent } from '@vp/ui';

export const LazyLiveViewersPlot = lazyComponent(() => import('./live-viewers-plot'), {
  name: 'LiveViewersPlot',
  pick: (module) => module.LiveViewersPlot,
  fallback: false,
});
