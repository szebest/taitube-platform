import type { PipelineMetrics } from '@vp/observability';
import type { Result } from '@vp/result';

export type StorageOp = 'put' | 'get' | 'head' | 'multipart' | 'delete' | 'list';

/** Records one storage call by its outcome: an `Err` is an error, whatever the SDK did to get it. */
export async function meterStorageOp<T, E>(
  metrics: PipelineMetrics,
  op: StorageOp,
  bucket: string,
  call: () => Promise<Result<T, E>>
): Promise<Result<T, E>> {
  const startedAt = performance.now();
  const outcome = await call();
  const labels = { op, bucket, result: outcome.ok ? 'success' : 'error' };
  metrics.storageOpsTotal.inc(labels);
  metrics.storageOpDuration.observe(labels, (performance.now() - startedAt) / 1000);
  return outcome;
}
