import {
  ChannelHeaderActions,
  ChannelHeaderBanner,
  ChannelHeaderBell,
  ChannelHeaderBio,
  ChannelHeaderIdentity,
  ChannelHeaderRoot,
  ChannelHeaderSubscribe,
  ChannelHeaderTab,
  ChannelHeaderTabs,
} from './channel-header';

export const ChannelHeader = {
  Root: ChannelHeaderRoot,
  Banner: ChannelHeaderBanner,
  Identity: ChannelHeaderIdentity,
  Bio: ChannelHeaderBio,
  Actions: ChannelHeaderActions,
  Subscribe: ChannelHeaderSubscribe,
  Bell: ChannelHeaderBell,
  Tabs: ChannelHeaderTabs,
  Tab: ChannelHeaderTab,
};
export { ChannelHeaderSkeleton } from './channel-header';
export { useChannelHeader } from './channel-header.context';
export { channelHeaderStyles } from './channel-header.variants';
