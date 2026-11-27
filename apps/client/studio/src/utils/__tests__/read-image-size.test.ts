import { readImageSize } from '../read-image-size';

describe('apps/client/studio: readImageSize', () => {
  it('answers the pixels of the decoded image and releases it', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 640, height: 360, close })
    );

    await expect(readImageSize(new Blob(['x']))).resolves.toEqual({ width: 640, height: 360 });
    expect(close).toHaveBeenCalledOnce();
  });

  it('answers nothing for a file the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('InvalidStateError')));

    await expect(readImageSize(new Blob(['x']))).resolves.toBeUndefined();
  });
});
