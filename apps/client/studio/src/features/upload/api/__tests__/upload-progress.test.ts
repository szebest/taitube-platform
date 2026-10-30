import { percentOf, uploadKeys, uploadProgressQueryOptions } from '../upload-progress';

describe('apps/client/studio: upload progress', () => {
  it.each([
    { loaded: 0, total: 8, percent: 0 },
    { loaded: 2, total: 8, percent: 25 },
    { loaded: 8, total: 8, percent: 100 },
    { loaded: 0, total: 0, percent: 0 },
  ])('reads $loaded of $total bytes as $percent percent', ({ loaded, total, percent }) => {
    expect(percentOf({ loaded, total })).toBe(percent);
  });

  it('keys each upload apart under the uploads key, and never fetches the bytes it holds', () => {
    const options = uploadProgressQueryOptions('upload-1');

    expect(options.queryKey).toEqual([...uploadKeys.all, 'progress', 'upload-1']);
    expect(options.queryKey).not.toEqual(uploadProgressQueryOptions('upload-2').queryKey);
    expect(options.staleTime).toBe(Number.POSITIVE_INFINITY);
  });
});
