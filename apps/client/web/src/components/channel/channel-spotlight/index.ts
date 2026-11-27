import {
  ChannelSpotlightActions,
  ChannelSpotlightKicker,
  ChannelSpotlightRoot,
} from './channel-spotlight';

export const ChannelSpotlight = {
  Root: ChannelSpotlightRoot,
  Kicker: ChannelSpotlightKicker,
  Actions: ChannelSpotlightActions,
};
export { ChannelSpotlightSkeleton } from './channel-spotlight';
export { useChannelSpotlight } from './channel-spotlight.context';
export { channelSpotlightStyles } from './channel-spotlight.variants';
export type { ChannelSpotlightSource } from './types';
