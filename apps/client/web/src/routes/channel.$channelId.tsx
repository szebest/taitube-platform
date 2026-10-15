import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';

import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { UserPage } from '#app/modules/UserPage';

export const Route = createFileRoute('/channel/$channelId')({
  params: {
    parse: ({ channelId }) => ({ channelId: parseParam(ChannelIdParamSchema.shape.id, channelId) }),
    stringify: ({ channelId }) => ({ channelId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient }, params: { channelId } }) => {
    await ensureFound(queryClient, channelQueryOptions(channelId));
  },
  component: UserPage,
});
