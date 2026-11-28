import { describeMetricsRegistryContract } from '@kit/observability/contract';
import { createPipelineMetrics } from '../pipeline-metrics';

describeMetricsRegistryContract(() => ({
  registry: createPipelineMetrics().registry,
  prefix: 'vp_',
}));
