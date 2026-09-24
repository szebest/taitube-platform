import { isSpanContextValid, trace } from '@opentelemetry/api';
import { registeredTracing } from '@vp/observability';
import { withEnv } from '@vp/testing';

const LOCAL_ENV = {
  ADAPTER_FAMILY: 'in-memory',
  DATABASE_URL: 'postgres://localhost:5432/vp',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:9',
};

/** A fresh module per call: each preload runs its top level again, as a new process would. */
async function preload(env: Record<string, string>): Promise<boolean> {
  const module = `../instrument?${env.NODE_ENV}`;
  await withEnv({ ...LOCAL_ENV, ...env }, () => import(module));
  return isSpanContextValid(trace.getTracer('probe').startSpan('probe').spanContext());
}

describe('apps/api: instrument', () => {
  afterEach(async () => {
    await registeredTracing.shutdown();
    trace.disable();
  });

  it('registers a recording tracer provider before main is imported', async () => {
    expect(await preload({ NODE_ENV: 'development' })).toBe(true);
  });

  it('registers nothing under test, where tracing is off', async () => {
    expect(await preload({ NODE_ENV: 'test' })).toBe(false);
  });
});
