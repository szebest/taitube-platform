import { lazyComponent } from '@kit/ui';

export const LazyStatsPanel = lazyComponent(() => import('./stats-panel'), {
  name: 'StatsPanel',
  pick: (module) => module.StatsPanel,
});
