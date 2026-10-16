import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { dropUrlQuery } from './drop-url-query';

export interface WebTracingOptions {
  serviceName: string;
  /** The OTLP/HTTP traces endpoint of the collector. */
  tracesUrl: string;
  /** The API origin. A fetch carries `traceparent` there and to the page's own origin, nowhere else. */
  apiOrigin: string;
}

/** The instrumentation matches a string URL exactly, so an origin is a pattern over everything under it. */
function originPattern(origin: string): RegExp {
  return new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`);
}

export function startWebTracing({ serviceName, tracesUrl, apiOrigin }: WebTracingOptions): void {
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [
      dropUrlQuery,
      new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesUrl })),
    ],
  });
  provider.register();

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [originPattern(apiOrigin)],
        ignoreUrls: [tracesUrl],
      }),
    ],
  });
}
