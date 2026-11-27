import type { ChannelImageCompletion } from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind } from '@vp/domain';

export const BANNER_CROPS: BannerCrops = {
  desktop: { x: 0, y: 0, width: 2400, height: 400 },
  mobile: { x: 0, y: 0, width: 1500, height: 500 },
  tv: { x: 0, y: 0, width: 1600, height: 900 },
};

/** What a finished upload of each kind reports: its pixels and a crop that fits them. */
export const DONE: Record<ChannelImageKind, ChannelImageCompletion> = {
  avatar: {
    width: 800,
    height: 800,
    crops: { kind: 'avatar', crop: { x: 0, y: 0, width: 400, height: 400 } },
  },
  banner: { width: 2560, height: 1440, crops: { kind: 'banner', crops: BANNER_CROPS } },
  'playlist-cover': {
    width: 1600,
    height: 900,
    crops: { kind: 'playlist-cover', crop: { x: 0, y: 0, width: 1600, height: 900 } },
  },
};
