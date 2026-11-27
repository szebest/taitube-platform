import type { ExperimentView } from '@vp/api-contracts';

export type ExperimentResultCardExperiment = Pick<
  ExperimentView,
  'variants' | 'results' | 'status' | 'winnerVariantId'
>;

/** One variant beside its numbers; `result` is absent until the API has counted anything for it. */
export type ExperimentResultCardVariant = ExperimentView['variants'][number] & {
  result: ExperimentView['results']['variants'][number] | undefined;
  winner: boolean;
};
