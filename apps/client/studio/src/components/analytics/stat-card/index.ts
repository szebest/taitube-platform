import {
  StatCardDelta,
  StatCardLabel,
  StatCardRoot,
  StatCardSpark,
  StatCardValue,
} from './stat-card';

export const StatCard = {
  Root: StatCardRoot,
  Label: StatCardLabel,
  Value: StatCardValue,
  Delta: StatCardDelta,
  Spark: StatCardSpark,
};
export { StatCardSkeleton } from './stat-card';
export { useStatCard } from './stat-card.context';
export { STAT_CARD_TREND_TONE, statCardStyles } from './stat-card.variants';
