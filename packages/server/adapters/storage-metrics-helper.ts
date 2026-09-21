import { getMetrics } from '@vp/observability';

export async function measureStorageOp<T>(
  op: 'put' | 'get' | 'head' | 'multipart' | 'delete' | 'list',
  bucket: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationSec = (Date.now() - start) / 1000;
    try {
      const metrics = getMetrics();
      metrics.storageOpsTotal.inc({ op, bucket, result: 'success' });
      metrics.storageOpDuration.observe({ op, bucket, result: 'success' }, durationSec);
    } catch {}
    return result;
  } catch (err) {
    const durationSec = (Date.now() - start) / 1000;
    try {
      const metrics = getMetrics();
      metrics.storageOpsTotal.inc({ op, bucket, result: 'error' });
      metrics.storageOpDuration.observe({ op, bucket, result: 'error' }, durationSec);
    } catch {}
    throw err;
  }
}
