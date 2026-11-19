import { StatCard } from '@kit/components';
import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import type { CreatorStats } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl-formats';
import type { ReactNode } from 'react';

function Stat({ label, value, spark }: { label: string; value: string; spark?: number[] }) {
  return (
    <StatCard.Root>
      <StatCard.Label>{label}</StatCard.Label>
      <StatCard.Value>{value}</StatCard.Value>
      {spark && <StatCard.Spark values={spark} />}
    </StatCard.Root>
  );
}

/** The views, watch time and average view duration of the last 30 days, and the likes, comments and subscribers gained since the video was made. */
export function StatsCards({ stats }: { stats: CreatorStats }): ReactNode {
  const { tOr } = useT();
  const { format } = useFormat();
  const { lifetime, last30Days } = stats;
  const count = (value: number) => unwrapOr(format({ type: 'count', value }), '');
  const time = (seconds: number) => unwrapOr(format(videoDuration(Math.round(seconds))), '');

  return (
    <div data-slot="creator-stats-cards" className="grid grid-cols-2 gap-inline medium:grid-cols-3">
      <Stat
        label={tOr('creatorStats.views', {}, '')}
        value={count(last30Days.views)}
        spark={last30Days.daily.map(({ views }) => views)}
      />
      <Stat label={tOr('creatorStats.watchTime', {}, '')} value={time(last30Days.watchSeconds)} />
      <Stat
        label={tOr('creatorStats.averageViewDuration', {}, '')}
        value={time(last30Days.averageViewDurationSeconds)}
      />
      <Stat label={tOr('creatorStats.likes', {}, '')} value={count(lifetime.likes)} />
      <Stat label={tOr('creatorStats.comments', {}, '')} value={count(lifetime.comments)} />
      <Stat
        label={tOr('creatorStats.subscribersGained', {}, '')}
        value={count(lifetime.subscribersGained)}
      />
    </div>
  );
}
