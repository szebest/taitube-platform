import { completePlaylistCover, preparePlaylistCover } from '../playlist-cover';

const UPLOAD_ID = '018f0000-0000-7000-8000-000000000001';

describe('packages/api-contracts: playlist cover', () => {
  it.each([
    { scenario: 'a whole upload', body: { contentType: 'image/png', sizeBytes: 10 }, ok: true },
    { scenario: 'an empty file', body: { contentType: 'image/png', sizeBytes: 0 }, ok: false },
  ])('takes $scenario to presign', ({ body, ok }) => {
    expect(preparePlaylistCover.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    {
      scenario: 'an upload with its crop',
      body: {
        uploadId: UPLOAD_ID,
        width: 1600,
        height: 900,
        crop: { x: 0, y: 0, width: 16, height: 9 },
      },
      ok: true,
    },
    {
      scenario: 'an upload without a crop',
      body: { uploadId: UPLOAD_ID, width: 1600, height: 900 },
      ok: false,
    },
  ])('takes $scenario to complete', ({ body, ok }) => {
    expect(completePlaylistCover.body.safeParse(body).success).toBe(ok);
  });
});
