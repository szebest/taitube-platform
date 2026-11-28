import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { coverImages } from '../cover-images';

const MOSAIC = ['/a.jpg', '/b.jpg', '/c.jpg'];

const coverOf = (mode: 'auto' | 'item' | 'custom', thumbnailUrl: string | null) =>
  coverImages(
    playlistDetail(uuid(1), [], {
      cover: { mode, videoId: null, mosaicUrls: MOSAIC },
      thumbnailUrl,
    })
  );

describe('apps/client/web: coverImages', () => {
  it.each([
    { mode: 'auto' as const, thumbnailUrl: '/one.jpg', images: MOSAIC },
    { mode: 'item' as const, thumbnailUrl: '/one.jpg', images: ['/one.jpg'] },
    { mode: 'custom' as const, thumbnailUrl: '/upload.jpg', images: ['/upload.jpg'] },
    { mode: 'item' as const, thumbnailUrl: null, images: [] },
  ])(
    'draws $images for the $mode mode with thumbnail $thumbnailUrl',
    ({ mode, thumbnailUrl, images }) => {
      expect(coverOf(mode, thumbnailUrl)).toEqual(images);
    }
  );
});
