import type { DateValue } from '@vp/intl';
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
import type { RangeAnalytics } from '../api/analytics-queries';
import { dayInstant } from '../day-instant';

const AXIS_TICK_SIZE = 12;
const SHORT_DAY = { month: 'short', day: 'numeric' } as const;

export interface ViewsPlotProps {
  timeline: RangeAnalytics['timeline'];
  name: string;
}

export function ViewsPlot({ timeline, name }: ViewsPlotProps) {
  const { format } = useFormat();
  const theme = useChartTheme();

  const day = (viewDate: string, options?: DateValue['options']) =>
    unwrapOr(format({ type: 'date', value: dayInstant(viewDate), options }), '');
  const count = (value: number) => unwrapOr(format({ type: 'count', value }), '');

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="viewDate"
          tickFormatter={(viewDate: string) => day(viewDate, SHORT_DAY)}
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
          labelFormatter={(viewDate) => day(String(viewDate))}
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
