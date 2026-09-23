import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { InMemoryStorageClient } from '../../in-memory/in-memory-storage-client';
import { MeteredStorageClient } from '../metered-storage-client';

async function counted(metrics: PipelineMetrics): Promise<string[]> {
  return (await metrics.storageOpsTotal.get()).values.map(
    ({ labels }) => `${labels.op}:${labels.bucket}:${labels.result}`
  );
}

describe('@vp/adapters: MeteredStorageClient', () => {
  let metrics: PipelineMetrics;
  let storage: MeteredStorageClient;

  beforeEach(async () => {
    metrics = createMetricsRegistry();
    storage = new MeteredStorageClient(new InMemoryStorageClient(), metrics);
    expectOk(
      await storage.uploadObject({ bucket: 'raw', key: 'a', body: 'x', contentType: 'video/mp4' })
    );
  });

  it.each([
    { call: 'headObject', run: (s: MeteredStorageClient) => s.headObject('raw', 'a'), op: 'head' },
    { call: 'getObject', run: (s: MeteredStorageClient) => s.getObject('raw', 'a'), op: 'get' },
    {
      call: 'listObjects',
      run: (s: MeteredStorageClient) => s.listObjects({ bucket: 'raw' }),
      op: 'list',
    },
    {
      call: 'deleteObject',
      run: (s: MeteredStorageClient) => s.deleteObject('raw', 'a'),
      op: 'delete',
    },
    {
      call: 'purgePrefix',
      run: (s: MeteredStorageClient) => s.purgePrefix('raw', ''),
      op: 'delete',
    },
  ])('answers $call from the wrapped client and counts it as $op', async ({ run, op }) => {
    expect((await run(storage)).ok).toBe(true);

    expect(await counted(metrics)).toEqual(['put:raw:success', `${op}:raw:success`]);
  });

  it('presigns without counting a storage call, since none is made', async () => {
    expectOk(
      await storage.createPresignedGetUrl({ bucket: 'raw', key: 'a', expiresInSeconds: 60 })
    );

    expect(await counted(metrics)).toEqual(['put:raw:success']);
  });
});
