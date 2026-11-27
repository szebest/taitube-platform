import { seriesColor } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '#app/components/analytics/chart-frame';

const AXIS_TICK_SIZE = 12;

export interface BenchmarkPoint {
  day: number;
  views: number | null;
  median: number;
  /** The 25th and the 75th percentile. */
  band: [number, number];
}

export interface BenchmarkPlotProps {
  points: BenchmarkPoint[];
  names: { views: string; median: string; band: string };
  dayLabel: (day: number) => string;
}

export function BenchmarkPlot({ points, names, dayLabel }: BenchmarkPlotProps) {
  const { format } = useFormat();
  const theme = useChartTheme();

  const count = (value: number) => unwrapOr(format({ type: 'count', value }), '');
  const shown = (value: unknown) =>
    Array.isArray(value)
      ? value.map((part) => count(Number(part))).join(' - ')
      : count(Number(value));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="day"
          tickFormatter={(day: number) => dayLabel(day)}
          tick={{ fill: theme.axis, fontSize: AXIS_TICK_SIZE }}
          axisLine={false}
          tickLine={false}
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
          labelFormatter={(day) => dayLabel(Number(day))}
          formatter={shown}
          contentStyle={{ background: theme.tooltipSurface, border: 'none' }}
        />
        <Area
          type="monotone"
          dataKey="band"
          name={names.band}
          stroke="none"
          fill={seriesColor(2)}
          fillOpacity={0.25}
        />
        <Line
          type="monotone"
          dataKey="median"
          name={names.median}
          stroke={seriesColor(1)}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="views"
          name={names.views}
          stroke={seriesColor(0)}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
