import { createCompoundContext } from '@kit/ui';
import type { ExperimentResultCardVariant } from './types';

export const [ExperimentResultCardContext, useExperimentResultCard] = createCompoundContext<{
  enoughData: boolean;
  variants: readonly ExperimentResultCardVariant[];
}>('ExperimentResultCard');
