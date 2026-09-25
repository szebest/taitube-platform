import { register } from 'node:module';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { type Result, ok, tryCatch } from '@vp/result';
import { type TraceSamplerName, resolveSampler } from './sampler';

interface TracingConfig {
  serviceName: string;
  enabled: boolean;
  serviceVersion: string;
  endpoint: string;
  sampler: TraceSamplerName;
  samplerArg: number;
  resourceAttributes: string;
}

/**
 * The hook wraps third-party modules only. It re-reads a module's `export *` itself, without the
 * loader that resolves this repo's extensionless specifiers, so wrapping our own code fails.
 */
const WORKSPACE_PACKAGE = /\/node_modules\/@vp\//;
const APP_SOURCE = /^file:\/\/(?!.*\/node_modules\/)/;

const toError = (cause: unknown): Error => new Error('tracing failed', { cause });

/** `OTEL_RESOURCE_ATTRIBUTES` is `key=value` pairs joined by commas; a pair with no `=` is dropped. */
function resourceAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key === '' || value === '') continue;
    attributes[key] = value;
  }
  return attributes;
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
        ...resourceAttributes(config.resourceAttributes),
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
