import { describeMetricsRegistryContract } from '../contract';
import { createMetricsRegistry } from '../metrics';

const PREFIX = 'contract_';

describeMetricsRegistryContract(() => ({
  registry: createMetricsRegistry({ prefix: PREFIX }),
  prefix: PREFIX,
}));
