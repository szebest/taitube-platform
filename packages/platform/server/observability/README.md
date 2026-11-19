# @kit/observability

A Prometheus registry, the scrape server that serves it, and OpenTelemetry tracing with W3C `traceparent`
propagation, none of it bound to a product.

```sh
pnpm add @kit/observability prom-client @opentelemetry/api @opentelemetry/core @opentelemetry/sdk-trace
```

`./tracing-sdk` additionally needs `@opentelemetry/auto-instrumentations-node`,
`@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/instrumentation`, `@opentelemetry/resources`,
`@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base` and `@opentelemetry/semantic-conventions`.

Tokens and registries: none. The metric prefix and the tracer name are parameters.

```ts
import { MetricsServer, createMetricsRegistry, getTracer } from '@kit/observability';

const registry = createMetricsRegistry({ prefix: 'app_' });
await new MetricsServer({ port: 9464, host: '0.0.0.0', registry }).listen();

const span = getTracer('app').startSpan('work');
span.end();
```
