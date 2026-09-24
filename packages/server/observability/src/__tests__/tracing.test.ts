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
  getActiveSpanContext,
  getActiveTraceparent,
  initTracing,
  injectTraceparent,
} from '../tracing';

describe('OpenTelemetry Tracing Module (packages/observability)', () => {
  it('creates valid W3C traceparent strings', () => {
    const tp = createTraceparent();
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

    const customTp = createTraceparent('0123456789abcdef0123456789abcdef', 'fedcba9876543210');
    expect(customTp).toBe('00-0123456789abcdef0123456789abcdef-fedcba9876543210-01');
  });

  it('hands back a handle whose shutdown succeeds when tracing is disabled', async () => {
    const tracing = initTracing({
      serviceName: 'vp-test',
      enabled: false,
      serviceVersion: 'test',
      endpoint: 'http://localhost:4318',
      sampler: 'always_on',
      samplerArg: 1,
      resourceAttributes: '',
    });

    expect(tracing.ok).toBe(true);
    expect(tracing.ok && (await tracing.value.shutdown())).toEqual({ ok: true, value: undefined });
  });

  it('extracts context from traceparent and allows child span hierarchy', () => {
    trace.disable();
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const contextManager = new AsyncLocalStorageContextManager().enable();
    context.setGlobalContextManager(contextManager);
    trace.setGlobalTracerProvider(provider);

    const tracer = provider.getTracer('test-tracer');
    const parentTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    const parentCtx = extractContextFromTraceparent(parentTraceparent);
    const childSpan = tracer.startSpan('child-operation', { kind: SpanKind.CONSUMER }, parentCtx);

    context.with(trace.setSpan(parentCtx, childSpan), () => {
      const activeTp = getActiveTraceparent();
      expect(activeTp).toBeDefined();
      expect(activeTp).toContain('4bf92f3577b34da6a3ce929d0e0e4736');

      const spanCtx = getActiveSpanContext();
      expect(spanCtx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(spanCtx.spanId).toBe(childSpan.spanContext().spanId);

      const carrier: Record<string, unknown> = {};
      injectTraceparent(carrier);
      expect(carrier.traceparent).toBe(activeTp);

      childSpan.setStatus({ code: SpanStatusCode.OK });
      childSpan.end();
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const [span] = spans;
    expect(span).toBeDefined();
    if (!span) throw new Error('Span missing');
    expect(span.name).toBe('child-operation');
    expect(span.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(span.parentSpanContext?.spanId).toBe('00f067aa0ba902b7');
  });
});
