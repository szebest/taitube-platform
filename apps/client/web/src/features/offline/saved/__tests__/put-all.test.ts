import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { putAll, sizeOf } from '../put-all';

const entries = ['a', 'b', 'c'].map((name) => ({
  url: `https://cdn.taitube.test/${name}`,
  body: name,
  type: 'text/plain',
}));

describe('apps/client/web: putAll', () => {
  it('stores every entry', async () => {
    const storage = fakeCacheStorage();

    const stored = await putAll(await storage.open('saved'), entries);

    expect(stored.ok).toBe(true);
    expect(storage.held('saved')).toEqual(entries.map(({ url }) => url));
  });

  it('stores none when a write fails, and says it ran out of space', async () => {
    const storage = fakeCacheStorage({
      failPut: (url) =>
        url.endsWith('/c') ? new DOMException('full', 'QuotaExceededError') : undefined,
    });

    const stored = await putAll(await storage.open('saved'), entries);

    expect(stored).toEqual({ ok: false, error: { reason: 'quota' } });
    expect(storage.held('saved')).toEqual([]);
  });

  it.each([
    { name: 'a full disk', cause: new DOMException('full', 'QuotaExceededError'), reason: 'quota' },
    {
      name: 'any other DOMException',
      cause: new DOMException('x', 'AbortError'),
      reason: 'failed',
    },
    { name: 'a plain error', cause: new Error('x'), reason: 'failed' },
  ])('classifies $name as $reason', async ({ cause, reason }) => {
    const storage = fakeCacheStorage({ failPut: () => cause });

    const stored = await putAll(await storage.open('saved'), entries);

    expect(stored).toEqual({ ok: false, error: { reason } });
  });

  it.each([
    { name: 'a string by its UTF-8 bytes', body: 'h\u00e9', size: 3 },
    { name: 'a buffer by its length', body: new ArrayBuffer(8), size: 8 },
  ])('sizes $name', ({ body, size }) => {
    expect(sizeOf({ url: 'https://cdn/a', body, type: null })).toBe(size);
  });
});
