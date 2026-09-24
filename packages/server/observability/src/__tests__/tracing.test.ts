import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  createTraceparent,
  extractContextFromTraceparent,
  getActiveTraceparent,
  initTracing,
  registeredTracing,
  rootTraceparent,
} from '../tracing';

const REMOTE_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function installProvider(): { provider: BasicTracerProvider; exporter: InMemorySpanExporter } {
  trace.disable();
  context.disable();
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(provider);
  return { provider, exporter };
}

describe('@vp/observability: tracing', () => {
  afterEach(() => {
    trace.disable();
    context.disable();
  });

  it('creates valid W3C traceparent strings', () => {
    expect(createTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(createTraceparent('0123456789abcdef0123456789abcdef', 'fedcba9876543210')).toBe(
      '00-0123456789abcdef0123456789abcdef-fedcba9876543210-01'
    );
  });

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

  it('reads no traceparent from a no-op span', () => {
    const noop = trace.getTracer('noop').startSpan('noop');

    context.with(trace.setSpan(context.active(), noop), () => {
      expect(getActiveTraceparent()).toBeUndefined();
    });
  });

  it('extracts context from traceparent and allows child span hierarchy', () => {
    const { provider, exporter } = installProvider();
    const parentCtx = extractContextFromTraceparent(REMOTE_TRACEPARENT);
    const childSpan = provider
      .getTracer('test-tracer')
      .startSpan('child-operation', { kind: SpanKind.CONSUMER }, parentCtx);

    context.with(trace.setSpan(parentCtx, childSpan), () => {
      const activeTp = getActiveTraceparent();
      expect(activeTp).toContain('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(activeTp?.split('-')[2]).toBe(childSpan.spanContext().spanId);

      childSpan.setStatus({ code: SpanStatusCode.OK });
      childSpan.end();
    });

    const [span] = exporter.getFinishedSpans();
    expect(span?.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(span?.parentSpanContext?.spanId).toBe('00f067aa0ba902b7');
  });

  it('gives every root its own trace, even inside another span', () => {
    const { provider, exporter } = installProvider();
    const outer = provider.getTracer('test').startSpan('housekeeping');

    const [first, second] = context.with(trace.setSpan(context.active(), outer), () => [
      rootTraceparent('reconcile.repair'),
      rootTraceparent('reconcile.repair'),
    ]);

    const traceIdOf = (traceparent?: string) => traceparent?.split('-')[1];
    expect(traceIdOf(first)).not.toBe(traceIdOf(second));
    expect(traceIdOf(first)).not.toBe(outer.spanContext().traceId);
    expect(exporter.getFinishedSpans().map((span) => span.parentSpanContext)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('gives every root fresh ids when tracing is off', () => {
    expect(rootTraceparent('reconcile.repair')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(rootTraceparent('a')).not.toBe(rootTraceparent('a'));
  });

  it('flushes the registered provider on shutdown', async () => {
    const { provider } = installProvider();
    const shutdown = vi.spyOn(provider, 'shutdown');

    expect(await registeredTracing.shutdown()).toEqual({ ok: true, value: undefined });
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('shuts down nothing when no provider is registered', async () => {
    expect(await registeredTracing.shutdown()).toEqual({ ok: true, value: undefined });
  });
});
