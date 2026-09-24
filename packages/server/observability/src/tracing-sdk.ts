import { register } from 'node:module';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
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
import { type Result, ok, tryCatch } from '@vp/result';

interface TracingConfig {
  serviceName: string;
  enabled: boolean;
  serviceVersion: string;
  endpoint: string;
  sampler: string;
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
