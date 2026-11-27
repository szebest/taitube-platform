import { token } from '@kit/composition';
import type {
  ChannelLayoutService,
  ChannelPageResolver,
  ChannelPageService,
} from '../services/index';

export interface ChannelPageServiceSet {
  channelLayoutService: ChannelLayoutService;
  channelPageService: ChannelPageService;
}

export const ChannelPageServices = {
  ChannelLayoutService: token<ChannelLayoutService>('ChannelLayoutService'),
  ChannelPageResolver: token<ChannelPageResolver>('ChannelPageResolver'),
  ChannelPageService: token<ChannelPageService>('ChannelPageService'),
};
