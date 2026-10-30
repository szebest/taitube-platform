import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { WatchPage } from '#app/features/watch/components/watch-page';
import { WatchPending } from '#app/features/watch/components/watch-pending';

const StartTimeSchema = z.coerce.number().int().nonnegative();

export const Route = createFileRoute('/watch/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({
    t: z
      .unknown()
      .optional()
      .transform((value) => {
        const parsed = StartTimeSchema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
      }),
  }),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    const video = await ensureFound(queryClient, videoQueryOptions(api, videoId));
    if (video.channel) {
      await queryClient.ensureQueryData(channelQueryOptions(api, video.channel.id));
    }
    return video;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? 'Taitube' }] }),
  pendingComponent: WatchPending,
  component: WatchPage,
});
