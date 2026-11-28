import { storageUnavailable } from '@kit/errors';
import { err, ok } from '@kit/result';
import { createPipelineMetrics } from '@vp/pipeline-metrics';
import { meterStorageOp } from '../storage-op-meter';

describe('@vp/adapters: meterStorageOp', () => {
  it.each([
    { outcome: ok('uploaded'), result: 'success' },
    { outcome: err(storageUnavailable('uploadObject')), result: 'error' },
  ])('counts a $result by the Result the call returned', async ({ outcome, result }) => {
    const metrics = createPipelineMetrics();

    expect(await meterStorageOp(metrics, 'put', 'raw', async () => outcome)).toBe(outcome);

    const { values } = await metrics.storageOpsTotal.get();
    expect(values).toEqual([{ value: 1, labels: { op: 'put', bucket: 'raw', result } }]);
    const durations = await metrics.storageOpDuration.get();
    expect(durations.values.some(({ labels }) => labels.result === result)).toBe(true);
  });
});
