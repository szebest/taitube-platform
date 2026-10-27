import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '@vp/ui';
import { CHART_SERIES } from '../chart-frame';
import { StatCard, StatCardSkeleton, statCardStyles } from '.';
import { StatCardRoot } from './stat-card';
import type { StatCardTrend } from './types';

const meta = {
  title: 'Studio/StatCard',
  component: StatCardRoot,
} satisfies Meta<typeof StatCardRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const VIEWS = [12, 14, 15, 15, 19, 22, 20, 27];

const DELTAS = {
  up: '+8.4% vs previous 28 days',
  down: '-3.1% vs previous 28 days',
  flat: '0.0% vs previous 28 days',
} satisfies Record<StatCardTrend, string>;

const GRID = 'tw:grid tw:grid-cols-2 tw:gap-grid-x tw:medium:grid-cols-3 tw:expanded:grid-cols-4';

export const Default: Story = {
  render: () => (
    <div className="tw:max-w-[20rem]">
      <StatCard.Root>
        <StatCard.Label>Views, last 28 days</StatCard.Label>
        <StatCard.Value>1.24M</StatCard.Value>
        <StatCard.Delta trend="up">{DELTAS.up}</StatCard.Delta>
        <StatCard.Spark values={VIEWS} series={0} />
      </StatCard.Root>
    </div>
  ),
};

export const DeltaDownAndFlat: Story = {
  render: () => (
    <div className={GRID}>
      {variantNames(DELTAS).map((trend) => (
        <StatCard.Root key={trend}>
          <StatCard.Label>Watch time, hours</StatCard.Label>
          <StatCard.Value>48,210</StatCard.Value>
          <StatCard.Delta trend={trend}>{DELTAS[trend]}</StatCard.Delta>
          <StatCard.Spark values={VIEWS} series={1} />
        </StatCard.Root>
      ))}
    </div>
  ),
};

export const Large: Story = {
  render: () => (
    <div className="tw:max-w-[28rem]">
      <StatCard.Root size="lg">
        <StatCard.Label>Views, last 28 days</StatCard.Label>
        <StatCard.Value>1.24M</StatCard.Value>
        <StatCard.Delta trend="up">{DELTAS.up}</StatCard.Delta>
        <StatCard.Spark values={VIEWS} series={0} />
      </StatCard.Root>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className={GRID}>
      {variantNames(statCardStyles.variants.size).map((size) => (
        <StatCard.Root key={size} size={size} state="loading">
          <StatCard.Label>Views, last 28 days</StatCard.Label>
        </StatCard.Root>
      ))}
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="tw:max-w-[20rem]">
      <StatCard.Root state="empty">
        <StatCard.Label>Subscribers gained</StatCard.Label>
        <StatCard.Value>0</StatCard.Value>
        <StatCard.Delta trend="flat">{DELTAS.flat}</StatCard.Delta>
        <StatCard.Spark values={VIEWS} />
      </StatCard.Root>
    </div>
  ),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => (
    <div className="tw:max-w-[20rem]">
      <StatCard.Root state="error" onRetry={() => undefined}>
        <StatCard.Label>Average view duration</StatCard.Label>
        <StatCard.Value>3:42</StatCard.Value>
      </StatCard.Root>
    </div>
  ),
};

export const Skeleton: Story = {
  render: () => (
    <div className={GRID}>
      {variantNames(statCardStyles.variants.size).map((size) => (
        <StatCardSkeleton key={size} size={size} />
      ))}
    </div>
  ),
};

export const Clickable: Story = {
  render: () => (
    <div className="tw:max-w-[20rem]">
      <StatCard.Root asChild>
        <a href="#views">
          <StatCard.Label>Views, last 28 days</StatCard.Label>
          <StatCard.Value>1.24M</StatCard.Value>
          <StatCard.Delta trend="up">{DELTAS.up}</StatCard.Delta>
          <StatCard.Spark values={VIEWS} series={0} />
        </a>
      </StatCard.Root>
    </div>
  ),
};

export const LargeNumbersNarrow: Story = {
  render: () => (
    <div className="tw:grid tw:max-w-[22rem] tw:grid-cols-2 tw:gap-grid-x">
      <StatCard.Root>
        <StatCard.Label>Impressions, last 365 days</StatCard.Label>
        <StatCard.Value>12.4M</StatCard.Value>
        <StatCard.Delta trend="up">+112.6% vs previous 365 days</StatCard.Delta>
        <StatCard.Spark values={VIEWS} series={3} />
      </StatCard.Root>
      <StatCard.Root>
        <StatCard.Label>Watch time, hours</StatCard.Label>
        <StatCard.Value>1,048,576</StatCard.Value>
        <StatCard.Delta trend="down">-12.0% vs previous 365 days</StatCard.Delta>
        <StatCard.Spark values={[...VIEWS].reverse()} series={4} />
      </StatCard.Root>
    </div>
  ),
};

export const EverySeriesColour: Story = {
  render: () => (
    <div className={GRID}>
      {CHART_SERIES.map((series) => (
        <StatCard.Root key={series}>
          <StatCard.Label>Series {series + 1}</StatCard.Label>
          <StatCard.Value>{(series + 1) * 1200}</StatCard.Value>
          <StatCard.Delta trend="up">+{series + 1}.0%</StatCard.Delta>
          <StatCard.Spark values={VIEWS.map((value) => value + series * 2)} series={series} />
        </StatCard.Root>
      ))}
    </div>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: Default.render,
};
