import { Readable } from 'node:stream';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { inMemoryStorageClientSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeStorageClientContract } from '../../__tests__/contract/storage-client.contract';
import { InMemoryStorageClient } from '../in-memory-storage-client';

describeStorageClientContract(inMemoryStorageClientSubject);

describe('InMemoryStorageClient', () => {
  it('collects a streamed body before storing it', async () => {
    const storage = new InMemoryStorageClient();

    expectOk(
      await storage.uploadObject({
        bucket: 'b',
        key: 'k',
        body: Readable.from([Buffer.from('he'), Buffer.from('llo')]),
        contentType: 'text/plain',
      })
    );

    expect(expectOk(await storage.getObject('b', 'k')).toString()).toBe('hello');
  });

  it('reports STORAGE_UNAVAILABLE from its health check once marked unhealthy', async () => {
    const storage = new InMemoryStorageClient();

    storage.setHealthy(false);

    expect(expectErr(await storage.checkHealth()).code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
  });
});
