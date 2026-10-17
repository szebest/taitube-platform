import { Registry } from 'prom-client';
import { createWebVitalsMetrics } from '../web-vitals-metrics';

const createMetrics = () => {
  const registry = new Registry();
  return { registry, metrics: createWebVitalsMetrics(registry) };
};

describe('createWebVitalsMetrics', () => {
  it.each([
    ['frontendLcp', 'frontend_lcp_seconds'],
    ['frontendInp', 'frontend_inp_seconds'],
    ['frontendCls', 'frontend_cls_ratio'],
    ['frontendFcp', 'frontend_fcp_seconds'],
    ['frontendTtfb', 'frontend_ttfb_seconds'],
  ] as const)('exposes %s as the %s histogram by app and route', async (field, name) => {
    const { registry, metrics } = createMetrics();

    metrics[field].observe({ app: 'web', route: '/watch/$videoId' }, 0.3);

    expect(await registry.getSingleMetricAsString(name)).toContain(
      `${name}_count{app="web",route="/watch/$videoId"} 1`
    );
  });
});
