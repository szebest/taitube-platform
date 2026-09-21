import { loadEnv } from '@vp/config';
import { initTracing } from '@vp/observability';
import { buildApp } from './app';
import { startMetricsServer } from './plugins/metrics';

export async function main(): Promise<void> {
  const env = loadEnv();
  initTracing({
    serviceName: 'vp-api',
  });
  const app = await buildApp({
    limits: {
      multipartThresholdBytes: env.S3_MULTIPART_THRESHOLD_BYTES,
      maxUploadBytes: env.MAX_UPLOAD_BYTES,
      maxInflightPerUser: env.MAX_INFLIGHT_PER_USER,
      rateLimitMax: env.UPLOAD_RATE_LIMIT_MAX,
    },
    cdnBaseUrl: env.CDN_BASE_URL,
  });

  const apiAddress = await app.listen({
    port: env.PORT,
    host: '0.0.0.0',
  });
  console.log(`[api] Fastify server listening on ${apiAddress}`);

  // Start Prometheus metrics server on isolated METRICS_PORT (SDD §6.1, AC 6)
  const metricsServer = await startMetricsServer(env.METRICS_PORT);
  console.log(`[api] Metrics server listening on http://0.0.0.0:${metricsServer.port}/metrics`);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal API error:', err);
    process.exit(1);
  });
}
