import { lazyComponent } from '@kit/ui';

export const LazyStatsSheet = lazyComponent(() => import('./stats-sheet'), {
  name: 'StatsSheet',
  pick: (module) => module.StatsSheet,
});
