import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { InMemoryMultipartStorage } from '../../in-memory/in-memory-multipart-storage';
import { InMemoryStorageClient } from '../../in-memory/in-memory-storage-client';
import { MeteredMultipartStorage } from '../metered-multipart-storage';

describe('@vp/adapters: MeteredMultipartStorage', () => {
  let metrics: PipelineMetrics;
  let multipart: MeteredMultipartStorage;

  beforeEach(() => {
    metrics = createMetricsRegistry();
    multipart = new MeteredMultipartStorage(
      new InMemoryMultipartStorage(new InMemoryStorageClient()),
      metrics
    );
  });

  it('counts every session call as multipart, and not the presign', async () => {
    const uploadId = expectOk(await multipart.createMultipartUpload('raw', 'k', 'video/mp4'));
    expectOk(
      await multipart.createPresignedPartUrl({
        bucket: 'raw',
        key: 'k',
        uploadId,
        partNumber: 1,
        expiresInSeconds: 60,
      })
    );
    expectOk(await multipart.listMultipartParts('raw', 'k', uploadId));
    expectOk(await multipart.abortMultipartUpload('raw', 'k', uploadId));

    const { values } = await metrics.storageOpsTotal.get();
    expect(values).toEqual([
      { value: 3, labels: { op: 'multipart', bucket: 'raw', result: 'success' } },
    ]);
  });
});
