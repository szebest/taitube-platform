import {
  ExperimentResultCardFooter,
  ExperimentResultCardHeader,
  ExperimentResultCardRoot,
  ExperimentResultCardSkeleton,
  ExperimentResultCardSummary,
  ExperimentResultCardVariants,
} from './experiment-result-card';

export const ExperimentResultCard = {
  Root: ExperimentResultCardRoot,
  Header: ExperimentResultCardHeader,
  Summary: ExperimentResultCardSummary,
  Variants: ExperimentResultCardVariants,
  Footer: ExperimentResultCardFooter,
  Skeleton: ExperimentResultCardSkeleton,
};
export type {
  ExperimentResultCardRootProps,
  ExperimentResultCardVariantsProps,
} from './experiment-result-card';
export { useExperimentResultCard } from './experiment-result-card.context';
export type { ExperimentResultCardExperiment, ExperimentResultCardVariant } from './types';
