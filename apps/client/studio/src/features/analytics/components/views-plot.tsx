import type { FormatValue } from '@vp/intl';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { seriesColor, useChartTheme } from '#app/components/analytics/chart-frame';

const AXIS_TICK_SIZE = 12;

export interface ViewsPoint {
  /** The ISO instant the bucket starts at. */
  at: string;
  views: number;
}

export interface ViewsPlotProps {
  points: ViewsPoint[];
  name: string;
  tick: (at: string) => FormatValue;
  label: (at: string) => FormatValue;
}

export function ViewsPlot({ points, name, tick, label }: ViewsPlotProps) {
  const { format } = useFormat();
  const theme = useChartTheme();

  const text = (value: FormatValue) => unwrapOr(format(value), '');
  const count = (value: number) => text({ type: 'count', value });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="at"
          tickFormatter={(at: string) => text(tick(at))}
          tick={{ fill: theme.axis, fontSize: AXIS_TICK_SIZE }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={count}
          tick={{ fill: theme.axis, fontSize: AXIS_TICK_SIZE }}
          axisLine={false}
          tickLine={false}
          width={48}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(at) => text(label(String(at)))}
          formatter={(value) => count(Number(value))}
          contentStyle={{ background: theme.tooltipSurface, border: 'none' }}
        />
        <Line
          type="monotone"
          dataKey="views"
          name={name}
          stroke={seriesColor(0)}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
