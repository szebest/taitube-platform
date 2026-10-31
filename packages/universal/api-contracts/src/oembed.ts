import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const OEmbedQuerySchema = z.object({
  url: z
    .string()
    .min(1)
    .describe('A watch page of this site: the web origin followed by /watch/<video id>'),
  format: z
    .enum(['json', 'xml'])
    .default('json')
    .describe('Only json is served; xml answers 501, as the oEmbed specification allows'),
  maxwidth: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('A ceiling for the width of the embed, in pixels'),
  maxheight: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('A ceiling for the height of the embed, in pixels'),
});

const OEmbedVideoSchema = z.object({
  type: z.literal('video'),
  version: z.literal('1.0'),
  title: z.string().optional().describe('Left out when the video has no title'),
  author_name: z.string().optional().describe('The channel name; left out without a channel'),
  author_url: z.string().optional().describe('The channel page'),
  provider_name: z.string(),
  provider_url: z.string().describe('The web app origin'),
  thumbnail_url: z.string().optional().describe('The 1280x720 poster, when there is one'),
  thumbnail_width: z.number().int().optional(),
  thumbnail_height: z.number().int().optional(),
  html: z.string().describe('An iframe on the embed page of the video, with its allow list'),
  width: z.number().int().positive().describe('The iframe width, 16:9 with the height'),
  height: z.number().int().positive(),
});

export const getOEmbed = defineEndpoint({
  method: 'GET',
  path: '/v1/oembed',
  tag: 'oEmbed',
  summary: 'oEmbed provider',
  description:
    'Open to anyone. The oEmbed 1.0 `video` response for the watch page url names, so pasting a link into Discord, Slack or Notion embeds the player. Public, ready videos only: any other video answers 404 as if it did not exist. The iframe is 16:9, at most 640 pixels wide and within maxwidth and maxheight. The watch page advertises this endpoint with a `link rel="alternate" type="application/json+oembed"` tag.',
  anonymous: true,
  query: OEmbedQuerySchema,
  status: 200,
  result: OEmbedVideoSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.OEMBED_URL_UNSUPPORTED],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    501: [ErrorCodes.OEMBED_FORMAT_UNSUPPORTED],
  },
});

export type OEmbedQuery = z.infer<typeof OEmbedQuerySchema>;
