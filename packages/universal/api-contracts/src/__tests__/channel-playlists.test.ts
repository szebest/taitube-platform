import { PAGE_SIZE_DEFAULT } from '@vp/pagination';
import { listChannelPlaylists } from '../channel-playlists';

const playlist = {
  id: '00000000-0000-7000-8000-0000000000a1',
  title: 'Lisbon after dark',
  description: '',
  thumbnailUrl: null,
  thumbnailUrls: [],
  videoCount: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('packages/api-contracts: channel playlists', () => {
  it('is an anonymous GET under the channel, by uuid or handle', () => {
    expect(listChannelPlaylists).toMatchObject({
      method: 'GET',
      path: '/v1/channels/:idOrHandle/playlists',
      anonymous: true,
      status: 200,
    });
    expect(listChannelPlaylists.params?.parse({ idOrHandle: '@creator' })).toEqual({
      idOrHandle: '@creator',
    });
  });

  it('pages by keyset only, the default page size at a time', () => {
    expect(listChannelPlaylists.query?.parse({})).toEqual({ limit: PAGE_SIZE_DEFAULT });
  });

  it('parses a playlist card and refuses a negative count', () => {
    const page = (item: object) =>
      listChannelPlaylists.result.safeParse({ items: [item], nextCursor: null }).success;

    expect(page(playlist)).toBe(true);
    expect(page({ ...playlist, videoCount: -1 })).toBe(false);
  });
});
