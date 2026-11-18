import { Registry, collectDefaultMetrics } from 'prom-client';

export interface MetricsConfig {
  /** Every default process metric carries it, so a scrape of any deployable names each series once. */
  prefix: string;
}

export function createMetricsRegistry({ prefix }: MetricsConfig): Registry {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix });
  return registry;
}
