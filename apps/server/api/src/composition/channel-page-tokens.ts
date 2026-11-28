import { token } from '@kit/composition';
import type {
  ChannelLayoutScheduleService,
  ChannelLayoutService,
  ChannelPageResolver,
  ChannelPageService,
} from '../services/index';

export interface ChannelPageServiceSet {
  channelLayoutService: ChannelLayoutService;
  channelLayoutScheduleService: ChannelLayoutScheduleService;
  channelPageService: ChannelPageService;
}

export const ChannelPageServices = {
  ChannelLayoutService: token<ChannelLayoutService>('ChannelLayoutService'),
  ChannelLayoutScheduleService: token<ChannelLayoutScheduleService>('ChannelLayoutScheduleService'),
  ChannelPageResolver: token<ChannelPageResolver>('ChannelPageResolver'),
  ChannelPageService: token<ChannelPageService>('ChannelPageService'),
};
