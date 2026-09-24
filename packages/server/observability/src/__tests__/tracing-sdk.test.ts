import { initTracing } from '../tracing-sdk';

describe('@vp/observability: tracing SDK', () => {
  it('starts nothing when tracing is disabled', () => {
    const started = initTracing({
      serviceName: 'vp-test',
      enabled: false,
      serviceVersion: 'test',
      endpoint: 'http://localhost:4318',
      sampler: 'always_on',
      samplerArg: 1,
      resourceAttributes: '',
    });

    expect(started).toEqual({ ok: true, value: undefined });
  });
});
