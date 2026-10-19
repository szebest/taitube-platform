import type { PlaylistSearchCard, VideoRecord } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { toChannelSuggestion, toSearchResultItem } from '../search-views';
import { TEST_SPRITE as SPRITE } from './service-deps';

const CDN = inProcessAppConfig({ cdn: 'http://cdn.example' }).cdn;
const AT = new Date('2026-09-01T00:00:00.000Z');
const noChannel = () => null;

const CHANNEL: Channel = {
  id: 'c-1',
  userId: 'u-1',
  handle: 'fireship',
  displayName: 'Fireship',
  avatarUrl: null,
  bannerUrl: 'banner.png',
  bio: 'short videos',
  links: [],
  subscriberCount: 7,
  videoCount: 0,
  totalViews: 0,
  createdAt: AT,
  updatedAt: AT,
};

function card(customThumbnailKey: string | null, coverKey: string | null): PlaylistSearchCard {
  return {
    playlist: {
      id: 'p-1',
      ownerId: 'u-1',
      title: 'Mix',
      description: '',
      visibility: 'public',
      isSystem: false,
      customThumbnailKey,
      createdAt: AT,
      updatedAt: AT,
    },
    owner: null,
    videoCount: 2,
    coverKey,
  };
}

describe('apps/server/api/services: search views', () => {
  it('shows a channel hit without its banner or owner', () => {
    expect(
      toSearchResultItem(
        { kind: 'channel', key: 1, id: 'c-1', channel: CHANNEL },
        CDN,
        SPRITE,
        noChannel
      )
    ).toEqual({
      type: 'channel',
      data: {
        id: 'c-1',
        handle: 'fireship',
        displayName: 'Fireship',
        avatarUrl: null,
        bio: 'short videos',
        subscriberCount: 7,
      },
    });
  });

  it.each([
    {
      custom: 'thumbs/custom.jpg',
      cover: 'videos/v/poster.jpg',
      url: 'http://cdn.example/thumbs/custom.jpg',
    },
    { custom: null, cover: 'videos/v/poster.jpg', url: 'http://cdn.example/videos/v/poster.jpg' },
    { custom: null, cover: null, url: null },
  ])('fronts a playlist with $url', ({ custom, cover, url }) => {
    const item = toSearchResultItem(
      { kind: 'playlist', key: 1, id: 'p-1', card: card(custom, cover) },
      CDN,
      SPRITE,
      noChannel
    );

    expect(item).toMatchObject({
      type: 'playlist',
      data: { thumbnailUrl: url, videoCount: 2, createdAt: AT.toISOString() },
    });
  });

  it("puts a video hit under its owner's channel", () => {
    const { id, handle, displayName, avatarUrl } = CHANNEL;
    const video = {
      id: 'v-1',
      ownerId: CHANNEL.userId,
      status: 'READY',
      createdAt: AT,
      updatedAt: AT,
    };

    const item = toSearchResultItem(
      { kind: 'video', key: 1, id: 'v-1', video: video as VideoRecord },
      CDN,
      SPRITE,
      (ownerId) => (ownerId === CHANNEL.userId ? { id, handle, displayName, avatarUrl } : null)
    );

    expect(item).toMatchObject({ type: 'video', data: { channel: { id, handle } } });
  });

  it('suggests a channel by its display name', () => {
    expect(toChannelSuggestion(CHANNEL)).toEqual({
      type: 'channel',
      text: 'Fireship',
      channelId: 'c-1',
      handle: 'fireship',
      avatarUrl: null,
    });
  });
});
