import { coverCrop } from '../cover-crop';

describe('apps/client/web: coverCrop', () => {
  it.each([
    {
      shape: 'a 16:9 image whole',
      size: { width: 1600, height: 900 },
      crop: { x: 0, y: 0, width: 1600, height: 900 },
    },
    {
      shape: 'a tall image across its middle',
      size: { width: 1280, height: 2000 },
      crop: { x: 0, y: 640, width: 1280, height: 720 },
    },
    {
      shape: 'a wide image down its middle',
      size: { width: 3000, height: 720 },
      crop: { x: 860, y: 0, width: 1280, height: 720 },
    },
  ])('crops $shape', ({ size, crop }) => {
    expect(coverCrop(size)).toEqual(crop);
  });
});
