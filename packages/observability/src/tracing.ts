import { type Context, type Tracer, context, propagation, trace } from '@opentelemetry/api';
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

// Ensure standard W3C traceparent propagator is configured as default
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

export interface TracingConfig {
  serviceName: string;
  enabled?: boolean;
  otlpEndpoint?: string;
  sampler?: 'always_on' | 'always_off' | 'parentbased_always_on' | 'ratio';
  sampleRatio?: number;
}

export interface TracingContext {
  traceparent?: string;
  spanId?: string;
  traceId?: string;
}

let sdkInstance: NodeSDK | null = null;

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

function resolveSampler(samplerType?: string, sampleRatio?: number): Sampler {
  const st = samplerType || process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on';
  const ratio =
    sampleRatio ??
    (process.env.OTEL_TRACES_SAMPLER_ARG
      ? Number.parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG)
      : 1.0);

  if (st === 'always_on') {
    return new AlwaysOnSampler();
  }
  if (st === 'always_off') {
    return new AlwaysOffSampler();
  }
  if (st === 'ratio') {
    return new TraceIdRatioBasedSampler(ratio);
  }
  // default: parentbased_always_on
  return new ParentBasedSampler({
    root: new AlwaysOnSampler(),
  });
}

/**
 * Initializes OpenTelemetry SDK for Node and Bun runtimes.
 */
export function initTracing(config: TracingConfig): NodeSDK | null {
  const isEnabled =
    config.enabled ??
    (process.env.OTEL_ENABLED !== 'false' &&
      (process.env.OTEL_ENABLED === 'true' ||
        process.env.NODE_ENV === 'production' ||
        Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)));

  if (!isEnabled) {
    return null;
  }

  if (sdkInstance) {
    return sdkInstance;
  }

  const endpoint =
    config.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  const resourceAttrs = parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || 'dev',
    ...resourceAttrs,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
  });

  const sampler = resolveSampler(config.sampler, config.sampleRatio);

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    sampler,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to keep traces uncluttered
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    sdkInstance = sdk;
  } catch (err) {
    // If native auto-instrumentation fails (e.g. on certain platforms), fail gracefully
    console.warn(`[otel] Warning: Failed to start NodeSDK: ${(err as Error).message}`);
    return null;
  }

  return sdk;
}

export async function shutdownTracing(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown().catch(() => {});
    sdkInstance = null;
  }
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
 * Parses W3C traceparent and returns an OpenTelemetry Context with the extracted Remote SpanContext.
 */
export function extractContextFromTraceparent(
  traceparent?: string,
  parentCtx: Context = context.active()
): Context {
  if (!traceparent) return parentCtx;

  const carrier: Record<string, string> = { traceparent };
  return propagation.extract(parentCtx, carrier);
}

/**
 * Injects W3C traceparent into an object carrier.
 */
export function injectTraceparent(
  carrier: Record<string, unknown> = {},
  ctx: Context = context.active()
): Record<string, unknown> {
  propagation.inject(ctx, carrier);
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

/**
 * Sanitizes command-line arguments removing presigned / sensitive URLs (SDD §13.3).
 */
export function redactCommand(argv: string[]): string[] {
  return argv.map((arg) => {
    try {
      if (arg.startsWith('http://') || arg.startsWith('https://')) {
        const u = new URL(arg);
        u.search = '';
        return u.toString();
      }
    } catch {
      // Not a valid URL, leave as is
    }
    return arg;
  });
}
