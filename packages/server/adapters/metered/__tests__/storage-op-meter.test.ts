import { storageUnavailable } from '@vp/errors';
import { createMetricsRegistry } from '@vp/observability';
import { err, ok } from '@vp/result';
import { meterStorageOp } from '../storage-op-meter';

describe('@vp/adapters: meterStorageOp', () => {
  it.each([
    { outcome: ok('uploaded'), result: 'success' },
    { outcome: err(storageUnavailable('uploadObject')), result: 'error' },
  ])('counts a $result by the Result the call returned', async ({ outcome, result }) => {
    const metrics = createMetricsRegistry();

    expect(await meterStorageOp(metrics, 'put', 'raw', async () => outcome)).toBe(outcome);

    const { values } = await metrics.storageOpsTotal.get();
    expect(values).toEqual([{ value: 1, labels: { op: 'put', bucket: 'raw', result } }]);
    const durations = await metrics.storageOpDuration.get();
    expect(durations.values.some(({ labels }) => labels.result === result)).toBe(true);
  });
});
