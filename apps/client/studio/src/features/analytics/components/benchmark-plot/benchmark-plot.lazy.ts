import { lazyComponent } from '@kit/ui';

export const LazyBenchmarkPlot = lazyComponent(() => import('./benchmark-plot'), {
  name: 'BenchmarkPlot',
  pick: (module) => module.BenchmarkPlot,
  fallback: false,
});
