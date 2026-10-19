import { ErrorCodes } from '@vp/errors';
import { ChannelHandleParamSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { FeedResponseSchema } from './feed';
import { KeysetQuerySchema } from './pagination';

export const listChannelVideos = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/videos',
  tag: 'Channels',
  summary: "List a channel's public videos",
  description:
    "Returns the channel's public ready videos newest first, by channel UUID or @handle, each under the channel's card. Anonymous access permitted.",
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: KeysetQuerySchema,
  status: 200,
  result: FeedResponseSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});
