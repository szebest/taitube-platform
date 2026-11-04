import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { liveCollaborators } from '../live-collaborators';

describe('worker: liveCollaborators', () => {
  it('builds a fresh uploader for each broadcast, writing to the public bucket', async () => {
    const storage = new InMemoryStorageClient();
    const { newUploader } = liveCollaborators({ config: inProcessAppConfig(), storage });
    const uploader = newUploader();

    uploader.enqueue(() =>
      uploader.put('live/s/index.m3u8', '#EXTM3U', {
        contentType: 'text/plain',
        cacheControl: 'no-cache',
      })
    );
    expectOk(await uploader.drained());

    expect(newUploader()).not.toBe(uploader);
    expect(expectOk(await storage.headObject('public', 'live/s/index.m3u8'))).not.toBeNull();
  });
});
