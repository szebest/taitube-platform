const DEFAULT_WORKER_STAGE = 'probe';

/**
 * Must stay the path the container's liveness probe reads
 * (`apps/worker/Dockerfile`, `infra/k8s/base/worker-*.yaml`).
 */
const DEFAULT_HEARTBEAT_PATH = '/tmp/vp/heartbeat';

export function getWorkerStage(): string {
  return process.env['WORKER_STAGE'] || DEFAULT_WORKER_STAGE;
}

export function getHeartbeatPath(): string {
  return process.env['WORKER_HEARTBEAT_PATH'] || DEFAULT_HEARTBEAT_PATH;
}
