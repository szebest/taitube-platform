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
  it('writes in the order it was asked, whatever each write takes', async () => {
    const { uploader } = setup();
    const order: string[] = [];
    const write = (name: string, ms: number) => async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(name);
      return ok();
    };

    uploader.enqueue(write('part', 20));
    uploader.enqueue(write('playlist', 0));
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
