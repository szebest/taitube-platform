import {
  type Context,
  type Tracer,
  context,
  defaultTextMapGetter,
  defaultTextMapSetter,
  propagation,
  trace,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  type Sampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { type Result, fromPromise, map, ok, tryCatch } from '@vp/result';

export interface TracingConfig {
  serviceName: string;
  enabled: boolean;
  serviceVersion: string;
  endpoint: string;
  sampler: string;
  samplerArg: number;
  resourceAttributes: string;
}

export interface TracingContext {
  traceparent?: string;
  spanId?: string;
  traceId?: string;
}

/** What `initTracing` hands its composition root, so shutting the SDK down needs no module state. */
export interface Tracing {
  shutdown(): Promise<Result<void, Error>>;
}

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

function parseResourceAttributes(raw?: string): Record<string, string> {
  if (!raw) return {};
  const attrs: Record<string, string> = {};
  for (const item of raw.split(',')) {
    const [k, v] = item.split('=');
    if (k && v) {
      attrs[k.trim()] = v.trim();
    }
  }
  return attrs;
}

function resolveSampler(st: string, ratio: number): Sampler {
  if (st === 'always_on') {
    return new AlwaysOnSampler();
  }
  if (st === 'always_off') {
    return new AlwaysOffSampler();
  }
  if (st === 'ratio') {
    return new TraceIdRatioBasedSampler(ratio);
  }
  return new ParentBasedSampler({
    root: new AlwaysOnSampler(),
  });
}

/**
 * Starts the OpenTelemetry SDK for Node and Bun. Disabled tracing is a handle whose shutdown does
 * nothing, and an SDK that cannot start is a failure the caller reports and runs on without.
 */
export function initTracing(config: TracingConfig): Result<Tracing, Error> {
  if (!config.enabled) return ok({ shutdown: async () => ok() });

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      ...parseResourceAttributes(config.resourceAttributes),
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${config.endpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    sampler: resolveSampler(config.sampler, config.samplerArg),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  return map(
    tryCatch(() => sdk.start(), toError),
    (): Tracing => ({ shutdown: () => fromPromise(() => sdk.shutdown(), toError) })
  );
}

export function getTracer(name = 'video-pipeline', version = '1.0.0'): Tracer {
  return trace.getTracer(name, version);
}

/**
 * Extracts W3C traceparent string from current active trace context, or returns undefined.
 */
export function getActiveTraceparent(): string | undefined {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) return undefined;
  const spanContext = activeSpan.spanContext();
  if (!(spanContext.traceId && spanContext.spanId)) return undefined;

  const flags = spanContext.traceFlags.toString(16).padStart(2, '0');
  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

/**
 * Extracts traceId and spanId from current active span.
 */
export function getActiveSpanContext(): TracingContext {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) return {};
  const ctx = activeSpan.spanContext();
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceparent: `00-${ctx.traceId}-${ctx.spanId}-${flags}`,
  };
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

export function injectTraceparent(
  carrier: Record<string, unknown> = {},
  ctx: Context = context.active()
): Record<string, unknown> {
  new W3CTraceContextPropagator().inject(ctx, carrier, defaultTextMapSetter);
  return carrier;
}

/**
 * Generates a fresh W3C traceparent (useful when starting an external root span if needed).
 */
export function createTraceparent(traceId?: string, spanId?: string): string {
  const tId =
    traceId ||
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const sId =
    spanId ||
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `00-${tId}-${sId}-01`;
}
