import { listChannelVideos } from '../channel-videos';

describe('packages/api-contracts: channel videos', () => {
  it('is an anonymous GET under the channel, by uuid or handle', () => {
    expect(listChannelVideos).toMatchObject({
      method: 'GET',
      path: '/v1/channels/:idOrHandle/videos',
      anonymous: true,
      status: 200,
    });
    expect(listChannelVideos.params?.parse({ idOrHandle: '@creator' })).toEqual({
      idOrHandle: '@creator',
    });
  });

  it('pages by keyset only, 20 at a time by default', () => {
    expect(listChannelVideos.query?.parse({ sort: 'popular' })).toEqual({ limit: 20 });
  });
});
