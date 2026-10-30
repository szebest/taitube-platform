import { randomBytes } from 'node:crypto';
import {
  type Context,
  ProxyTracerProvider,
  type SpanContext,
  type Tracer,
  context,
  defaultTextMapGetter,
  isSpanContextValid,
  trace,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { TracerProvider as SdkTracerProvider } from '@opentelemetry/sdk-trace';
import { type Result, fromPromise, ok } from '@vp/result';

/** What a process flushes its spans through on shutdown. */
export interface Tracing {
  shutdown(): Promise<Result<void, Error>>;
}

const TRACER_NAME = 'video-pipeline';

const toError = (cause: unknown): Error => new Error('tracing failed', { cause });

/**
 * Flushes and stops whichever tracer provider the preload registered; with tracing off the global
 * provider is a no-op without `shutdown`, and this resolves at once.
 */
export const registeredTracing: Tracing = {
  shutdown: async () => {
    let provider = trace.getTracerProvider();
    if (provider instanceof ProxyTracerProvider) {
      provider = provider.getDelegate();
    }
    if (!(provider instanceof SdkTracerProvider)) {
      return ok();
    }
    const sdkProvider = provider;
    return fromPromise(() => sdkProvider.shutdown(), toError);
  },
};

export function getTracer(name = TRACER_NAME, version = '1.0.0'): Tracer {
  return trace.getTracer(name, version);
}

function toTraceparent(spanContext: SpanContext): string {
  const flags = spanContext.traceFlags.toString(16).padStart(2, '0');
  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

function activeSpanContext(): SpanContext | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && isSpanContextValid(spanContext) ? spanContext : undefined;
}

/** The active span as a W3C `traceparent`; a no-op span, whose ids are all zero, has none. */
export function getActiveTraceparent(): string | undefined {
  const spanContext = activeSpanContext();
  return spanContext ? toTraceparent(spanContext) : undefined;
}

/**
 * Parses a W3C traceparent into a Context carrying the remote span. The W3C propagator is used
 * directly rather than the global one, which is a no-op until `initTracing` runs.
 */
export function extractContextFromTraceparent(
  traceparent?: string,
  parentCtx: Context = context.active()
): Context {
  if (!traceparent) return parentCtx;
  return new W3CTraceContextPropagator().extract(parentCtx, { traceparent }, defaultTextMapGetter);
}

export function createTraceparent(traceId?: string, spanId?: string): string {
  return `00-${traceId || randomBytes(16).toString('hex')}-${spanId || randomBytes(8).toString('hex')}-01`;
}

/**
 * A traceparent for work nothing traced asked for, such as a repair the reconciler makes: a root
 * span of its own when tracing is on, otherwise fresh ids, so no two repairs share a trace.
 */
export function rootTraceparent(name: string): string {
  const span = getTracer().startSpan(name, { root: true });
  const spanContext = span.spanContext();
  span.end();
  return isSpanContextValid(spanContext) ? toTraceparent(spanContext) : createTraceparent();
}
