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

export interface LiveViewersPoint {
  /** The ISO instant the count arrived at. */
  at: string;
  viewers: number;
}

export interface LiveViewersPlotProps {
  points: LiveViewersPoint[];
  name: string;
}

const clock = (at: string): FormatValue => ({
  type: 'time',
  value: at,
  options: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
});

export function LiveViewersPlot({ points, name }: LiveViewersPlotProps) {
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
          tickFormatter={(at: string) => text(clock(at))}
          tick={{ fill: theme.axis, fontSize: AXIS_TICK_SIZE }}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
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
          labelFormatter={(at) => text(clock(String(at)))}
          formatter={(value) => count(Number(value))}
          contentStyle={{ background: theme.tooltipSurface, border: 'none' }}
        />
        <Line
          type="monotone"
          dataKey="viewers"
          name={name}
          stroke={seriesColor(0)}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
