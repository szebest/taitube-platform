import { randomBytes } from 'node:crypto';
import { register } from 'node:module';
import {
  type Context,
  ProxyTracerProvider,
  type SpanContext,
  type Tracer,
  context,
  defaultTextMapGetter,
  defaultTextMapSetter,
  isSpanContextValid,
  trace,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { TracerProvider as SdkTracerProvider } from '@opentelemetry/sdk-trace';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  type Sampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { type Result, fromPromise, ok, tryCatch } from '@vp/result';

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

/** What a process flushes its spans through on shutdown. */
export interface Tracing {
  shutdown(): Promise<Result<void, Error>>;
}

const TRACER_NAME = 'video-pipeline';

/**
 * The hook wraps third-party modules only. It re-reads a module's `export *` itself, without the
 * loader that resolves this repo's extensionless specifiers, so wrapping our own code fails.
 */
const WORKSPACE_PACKAGE = /\/node_modules\/@vp\//;
const APP_SOURCE = /^file:\/\/(?!.*\/node_modules\/)/;

const toError = (cause: unknown): Error => new Error('tracing failed', { cause });

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
 * Starts the OpenTelemetry SDK. It patches only what is imported after it, so a process calls it
 * from the module it preloads with `--import`, before `main` imports Fastify, `pg` or `ioredis`.
 * Incoming HTTP is left to the API's own request span, which knows the route; metrics stay with
 * Prometheus and logs with pino, so the SDK exports traces only.
 */
export function initTracing(config: TracingConfig): Result<void, Error> {
  if (!config.enabled) return ok();

  return tryCatch(() => {
    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
      data: { exclude: [WORKSPACE_PACKAGE, APP_SOURCE] },
    });
    new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_VERSION]: config.serviceVersion,
        ...parseResourceAttributes(config.resourceAttributes),
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${config.endpoint.replace(/\/$/, '')}/v1/traces`,
      }),
      sampler: resolveSampler(config.sampler, config.samplerArg),
      metricReaders: [],
      logRecordProcessors: [],
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: () => true },
        }),
      ],
    }).start();
  }, toError);
}

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

export function getActiveSpanContext(): TracingContext {
  const spanContext = activeSpanContext();
  if (!spanContext) return {};
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceparent: toTraceparent(spanContext),
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
