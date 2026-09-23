/**
 * Keys this repo hands to something other than its own code. `toAppConfig` never reads them;
 * each names the consumer that does, so a key nobody reads has nowhere to hide.
 */
export const PLATFORM_ENV = {
  NODE_OPTIONS: 'Node itself: compose and the images preload @vp/config/register',
  TURBO_TELEMETRY_DISABLED: 'turbo, which phones home unless told not to',
  DO_NOT_TRACK: 'turbo and every tool that honours the convention',
  OTEL_EXPORTER_OTLP_HEADERS: 'Grafana Alloy, infra/k8s/overlays/cloud/alloy.yaml',
  WORKER_RUNTIME: 'the worker image CMD and the k8s worker command, apps/worker/Dockerfile',
  REDIS_ADDR: 'the KEDA redis trigger, addressFromEnv in infra/k8s/base/scaled-objects.yaml',
} as const;

export type PlatformEnvKey = keyof typeof PLATFORM_ENV;
