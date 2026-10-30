import type { VideoRetention } from '@vp/api-contracts';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartTheme } from '#app/components/analytics/chart-frame';
import { retentionCells } from '../api/retention-cells';

const AXIS_TICK_SIZE = 12;

export interface RetentionPlotProps {
  curve: VideoRetention['curve'];
  name: string;
}

export function RetentionPlot({ curve, name }: RetentionPlotProps) {
  const { format } = useFormat();
  const theme = useChartTheme();

  const percent = (value: number) => unwrapOr(format({ type: 'percent', value }), '');
  const count = (value: number) => unwrapOr(format({ type: 'count', value }), '');

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={retentionCells(curve)}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={1}
      >
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="percent"
          tickFormatter={percent}
          tick={{ fill: theme.axis, fontSize: AXIS_TICK_SIZE }}
          axisLine={false}
          tickLine={false}
          interval={3}
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
          labelFormatter={(value) => percent(Number(value))}
          formatter={(value) => count(Number(value))}
          contentStyle={{ background: theme.tooltipSurface, border: 'none' }}
        />
        <Bar dataKey="viewers" name={name} radius={[2, 2, 0, 0]}>
          {retentionCells(curve).map(({ percent: position, fill }) => (
            <Cell key={position} fill={fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
