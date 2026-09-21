import { measureStorageOp } from '../storage-metrics-helper';

describe('measureStorageOp', () => {
  it('returns the result of the wrapped operation', async () => {
    expect(await measureStorageOp('put', 'raw', async () => 'uploaded')).toBe('uploaded');
  });

  it('rethrows the original failure untouched', async () => {
    const failure = new Error('bucket unreachable');

    await expect(
      measureStorageOp('get', 'raw', async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });

  it('does not let a metrics registry that is not wired up break the operation', async () => {
    expect(await measureStorageOp('list', 'videos', async () => ['a'])).toEqual(['a']);
  });
});
