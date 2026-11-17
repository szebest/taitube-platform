import { token } from '@kit/composition';
import type {
  ApiTokenService,
  ChannelExportService,
  OEmbedService,
  WebhookService,
} from '../services/index';

export interface IntegrationServiceSet {
  channelExportService: ChannelExportService;
  oembedService: OEmbedService;
  webhookService: WebhookService;
  apiTokenService: ApiTokenService;
}

export const IntegrationServices = {
  ChannelExportService: token<ChannelExportService>('ChannelExportService'),
  OEmbedService: token<OEmbedService>('OEmbedService'),
  WebhookService: token<WebhookService>('WebhookService'),
  ApiTokenService: token<ApiTokenService>('ApiTokenService'),
};
