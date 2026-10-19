import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelHandleParamSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const ChannelPlaylistSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().nullable().describe('The custom thumbnail, else the first video poster'),
  thumbnailUrls: z
    .array(z.string())
    .describe('Posters of the first videos in playlist order, up to three, for a stacked card'),
  videoCount: z.number().int().nonnegative().describe('Videos a visitor may watch'),
  updatedAt: z.string().describe('ISO 8601 timestamp of the last change, items included'),
});

export const listChannelPlaylists = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/playlists',
  tag: 'Channels',
  summary: "List a channel's public playlists",
  description:
    "Returns the channel's public playlists, most recently changed first, by channel UUID or @handle, each with the number of videos a visitor may watch and its first thumbnails. Keyset-paginated on (updated_at, id). Anonymous access permitted.",
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(ChannelPlaylistSchema), nextCursor: z.string().nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type ChannelPlaylistView = z.infer<typeof ChannelPlaylistSchema>;
