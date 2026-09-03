export function getWorkerStage(): string {
  return process.env['WORKER_STAGE'] ?? 'probe';
}
