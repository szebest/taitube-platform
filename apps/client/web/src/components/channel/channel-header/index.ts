import {
  ChannelHeaderActions,
  ChannelHeaderBanner,
  ChannelHeaderBannerLink,
  ChannelHeaderBell,
  ChannelHeaderBio,
  ChannelHeaderIdentity,
  ChannelHeaderRoot,
  ChannelHeaderTab,
  ChannelHeaderTabs,
} from './channel-header';

export const ChannelHeader = {
  Root: ChannelHeaderRoot,
  Banner: ChannelHeaderBanner,
  BannerLink: ChannelHeaderBannerLink,
  Identity: ChannelHeaderIdentity,
  Bio: ChannelHeaderBio,
  Actions: ChannelHeaderActions,
  Bell: ChannelHeaderBell,
  Tabs: ChannelHeaderTabs,
  Tab: ChannelHeaderTab,
};
export { ChannelHeaderSkeleton } from './channel-header-skeleton';
export { useChannelHeader } from './channel-header.context';
export { channelHeaderStyles } from './channel-header.variants';
