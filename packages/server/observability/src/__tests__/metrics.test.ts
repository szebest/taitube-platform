import { createMetricsRegistry } from '../metrics';

describe('createMetricsRegistry', () => {
  it('prefixes every default process metric with the prefix it is handed', async () => {
    const registry = createMetricsRegistry({ prefix: 'spec_' });

    const names = (await registry.getMetricsAsJSON()).map((metric) => metric.name);

    expect(names).toContain('spec_process_cpu_seconds_total');
    expect(names.every((name) => name.startsWith('spec_'))).toBe(true);
  });

  it('gives each call a registry of its own', () => {
    expect(createMetricsRegistry({ prefix: 'a_' })).not.toBe(
      createMetricsRegistry({ prefix: 'a_' })
    );
  });
});
