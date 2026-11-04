import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, storageUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { LiveUploader } from '../live-uploader';

const HEADERS = { contentType: 'text/plain', cacheControl: 'no-cache' };

function setup() {
  const storage = new InMemoryStorageClient();
  return { storage, uploader: new LiveUploader(storage, 'public') };
}

describe('worker/live: LiveUploader', () => {
  it('starts a write only once the one before it has finished', async () => {
    const { uploader } = setup();
    const order: string[] = [];
    const part = Promise.withResolvers<void>();

    uploader.enqueue(async () => {
      await part.promise;
      order.push('part');
      return ok();
    });
    uploader.enqueue(async () => {
      order.push('playlist');
      return ok();
    });
    await Promise.resolve();
    expect(order).toEqual([]);

    part.resolve();
    expectOk(await uploader.drained());
    expect(order).toEqual(['part', 'playlist']);
  });

  it('puts an object with its headers', async () => {
    const { storage, uploader } = setup();

    uploader.enqueue(() => uploader.put('live/s/index.m3u8', '#EXTM3U', HEADERS));
    expectOk(await uploader.drained());

    expect(expectOk(await storage.headObject('public', 'live/s/index.m3u8'))).toMatchObject({
      contentType: 'text/plain',
      cacheControl: 'no-cache',
    });
  });

  it('stops at the first failed write and raises its signal', async () => {
    const { uploader } = setup();
    const after = vi.fn(async () => ok());

    uploader.enqueue(async () => err(storageUnavailable('uploadObject')));
    uploader.enqueue(after);

    expect(expectErr(await uploader.drained()).code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    expect(after).not.toHaveBeenCalled();
    expect(uploader.signal.aborted).toBe(true);
  });
});
