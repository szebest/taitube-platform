import { z } from 'zod';

export const ChannelImageJob = z.object({
  type: z.literal('channel-image'),
  uploadId: z.uuid(),
  channelId: z.uuid(),
  kind: z.enum(['avatar', 'banner']),
  traceparent: z.string(),
  requestId: z.string().optional(),
});
export type ChannelImageJob = z.infer<typeof ChannelImageJob>;
