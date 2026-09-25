import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { z } from 'zod';

import { parseParam } from '#app/integrations/router/parse-param';
import { UserPage } from '#app/modules/UserPage';

export const Route = createFileRoute('/channel/$channelId')({
  params: {
    parse: ({ channelId }) => ({ channelId: parseParam(ChannelIdParamSchema.shape.id, channelId) }),
    stringify: ({ channelId }) => ({ channelId }),
  },
  validateSearch: z.object({}),
  component: UserPage,
});
