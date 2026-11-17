import type { CreatorStats } from '@vp/api-contracts';
import { seriesColor } from '@vp/components';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { SegmentedControl } from '@vp/ui';
import { useState } from 'react';

type Range = 'hours' | 'days';

const BAR_WIDTH = 10;
const GAP = 2;
const HEIGHT = 100;

function Bars({ views }: { views: readonly number[] }) {
  const peak = Math.max(...views, 1);
  const pitch = BAR_WIDTH + GAP;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${views.length * pitch} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
    >
      {views.map((count, slot) => {
        const x = slot * pitch;
        return (
          <rect
            key={x}
            x={x}
            y={HEIGHT - (count / peak) * HEIGHT}
            width={BAR_WIDTH}
            height={(count / peak) * HEIGHT}
            style={{ fill: seriesColor(0) }}
          />
        );
      })}
    </svg>
  );
}

/** Views by hour over the first 48 hours, while that window is open, or by day over the last 30. */
export function StatsChart({ stats }: { stats: CreatorStats }) {
  const { tOr } = useT();
  const { format } = useFormat();
  const [chosen, setChosen] = useState<Range>('hours');
  const first = stats.first48Hours;
  const range = first ? chosen : 'days';
  const views =
    range === 'hours' && first
      ? first.hours.map(({ views: count }) => count)
      : stats.last30Days.daily.map(({ views: count }) => count);
  const peak = unwrapOr(format({ type: 'count', value: Math.max(...views, 0) }), '');

  return (
    <div data-slot="creator-stats-chart" className="flex flex-col gap-inline">
      <SegmentedControl.Root
        aria-label={tOr('creatorStats.rangeLabel', {}, '')}
        value={range}
        onValueChange={(next) => setChosen(next === 'days' ? 'days' : 'hours')}
      >
        {first && (
          <SegmentedControl.Item value="hours">
            {tOr('creatorStats.first48Hours', {}, '')}
          </SegmentedControl.Item>
        )}
        <SegmentedControl.Item value="days">
          {tOr('creatorStats.last30Days', {}, '')}
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      <div
        role="img"
        aria-label={tOr(
          range === 'hours' ? 'creatorStats.chartHours' : 'creatorStats.chartDays',
          { peak },
          ''
        )}
      >
        <Bars views={views} />
      </div>
    </div>
  );
}
