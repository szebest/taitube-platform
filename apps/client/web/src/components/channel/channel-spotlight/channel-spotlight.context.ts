import { createCompoundContext } from '@kit/ui';
import type { ChannelSpotlightSource } from './types';

export const [ChannelSpotlightContext, useChannelSpotlight] = createCompoundContext<{
  source: ChannelSpotlightSource;
  kickerId: string;
}>('ChannelSpotlight');
