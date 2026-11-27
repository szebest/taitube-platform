# @kit/web-telemetry

Real-user Core Web Vitals and browser traces for a TanStack Router app, loaded after hydration. It names no product,
no endpoint and no contract.

```sh
pnpm add @kit/web-telemetry react @tanstack/react-router @opentelemetry/api \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/instrumentation @opentelemetry/instrumentation-fetch \
  @opentelemetry/resources @opentelemetry/sdk-trace-web @opentelemetry/semantic-conventions web-vitals
```

The app provides one `WebTelemetryOptions` to `useWebTelemetry`: `app` and `serviceName` (the labels), `apiBaseUrl`,
`vitals` (the endpoint path and the most vitals per batch) and `tracesUrl` (unset loads no tracer).

```tsx
import { useWebTelemetry } from '@kit/web-telemetry';

useWebTelemetry({
  app: 'web',
  serviceName: 'my-product-web',
  apiBaseUrl: 'https://api.example.com',
  vitals: { path: '/v1/telemetry/vitals', maxBatchSize: 32 },
  tracesUrl: undefined,
});
```
