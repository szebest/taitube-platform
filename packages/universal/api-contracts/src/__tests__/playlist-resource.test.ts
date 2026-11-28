import { PlaylistSchema, ShareQuerySchema } from '../playlist-resource';

describe('packages/api-contracts: playlist resource', () => {
  it.each([
    { scenario: 'no token', query: {}, valid: true },
    { scenario: 'a token', query: { s: 'abcdefghijklmnopqrstuv' }, valid: true },
    { scenario: 'a short token', query: { s: 'abc' }, valid: false },
  ])('reads a share query with $scenario: $valid', ({ query, valid }) => {
    expect(ShareQuerySchema.safeParse(query).success).toBe(valid);
  });

  it('shows at most four thumbnails in an auto mosaic', () => {
    const cover = PlaylistSchema.shape.cover;

    expect(
      [4, 5].map(
        (count) =>
          cover.safeParse({ mode: 'auto', videoId: null, mosaicUrls: Array(count).fill('u') })
            .success
      )
    ).toEqual([true, false]);
  });
});
