import { getHome, getRelatedVideos } from '../recommendations';

describe('packages/api-contracts: recommendations', () => {
  it.each([
    { contract: getHome, path: '/v1/home' },
    { contract: getRelatedVideos, path: '/v1/videos/:id/related' },
  ])('is an anonymous GET $path', ({ contract, path }) => {
    expect(contract).toMatchObject({ method: 'GET', path, anonymous: true, status: 200 });
  });

  it('refuses a related request for a malformed video id', () => {
    expect(getRelatedVideos.params.safeParse({ id: 'lisbon' }).success).toBe(false);
  });
});
