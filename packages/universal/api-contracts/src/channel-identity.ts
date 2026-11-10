import { ErrorCodes } from '@vp/errors';
import { CHANNEL_IMAGE_KINDS } from '@vp/validation';
import { z } from 'zod';
import { CropRectSchema } from './channel-images';
import { BannerCropsSchema, ChannelHandleParamSchema, ChannelIdParamSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { VideoSummarySchema } from './video-resource';

const ImageKindParamSchema = z.object({ kind: z.enum(CHANNEL_IMAGE_KINDS) });

const PrepareImageBodySchema = z.object({
  contentType: z.string().min(1).describe('image/jpeg, image/png or image/webp'),
  sizeBytes: z.number().int().positive().describe('At most 2 MB for an avatar, 6 MB for a banner'),
});

const PreparedImageSchema = z.object({
  uploadId: z.uuid().describe('What `completeChannelImage` is given once the file is uploaded'),
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()).describe('Sent with the PUT, exactly as given'),
  expiresAt: z.iso.datetime(),
});

const CompleteImageBodySchema = z.object({
  uploadId: z.uuid(),
  width: z
    .number()
    .int()
    .positive()
    .describe('Pixels of the uploaded file, as the browser decoded it; the job reads it again'),
  height: z.number().int().positive(),
  crop: CropRectSchema.optional().describe('An avatar: the square, in pixels of the uploaded file'),
  crops: BannerCropsSchema.optional().describe('A banner: one rectangle per target'),
});

const QueuedImageSchema = z.object({
  uploadId: z.uuid(),
  version: z
    .number()
    .int()
    .positive()
    .describe('What the channel serves once the job is done, announced as `channel.image.ready`'),
});

const SpotlightVideoSchema = VideoSummarySchema.nullable();

const SpotlightSchema = z.object({
  source: z
    .enum(['returning', 'trailer'])
    .nullable()
    .describe('Which slot the video came from; null when nothing is set or it no longer qualifies'),
  video: SpotlightVideoSchema,
});

const LocalizationSchema = z.object({
  locale: z.string().min(2).max(35).describe('A locale the app supports, e.g. `pl`'),
  description: z
    .string()
    .max(5000)
    .nullable()
    .describe('Plain text; null falls back to the default'),
  trailerVideoId: z.uuid().nullable().describe('null falls back to the default trailer'),
});

const SpotlightSettingsSchema = z.object({
  trailerVideoId: z.uuid().nullable(),
  returningVideoId: z.uuid().nullable(),
  localizations: z.array(LocalizationSchema),
});

const ContactSchema = z.object({ email: z.email() });

const CHANNEL_WRITE_ERRORS = {
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.CHANNEL_NOT_FOUND],
} as const;

export const prepareChannelImage = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/images/:kind/upload',
  channelScoped: true,
  tag: 'Account',
  summary: 'Presign an avatar or banner upload',
  description:
    'Returns a presigned PUT into the private raw bucket for an image of the acting channel (jpeg, png or webp; 2 MB for an avatar, 6 MB for a banner). PUT the file, then call `completeChannelImage`.',
  params: ImageKindParamSchema,
  body: PrepareImageBodySchema,
  status: 201,
  result: PreparedImageSchema,
  errors: {
    ...CHANNEL_WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    422: [ErrorCodes.UPLOAD_TOO_LARGE, ErrorCodes.UNSUPPORTED_CONTENT_TYPE],
  },
});

export const completeChannelImage = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/images/:kind/complete',
  channelScoped: true,
  tag: 'Account',
  summary: 'Crop an uploaded image and start processing it',
  description:
    'Checks the uploaded file (type, size and dimensions: an avatar at least 200 x 200, a banner at least 1024 x 576) and the crops against it, then queues the job that strips metadata and writes the WebP variants. An avatar takes one square `crop`; a banner takes `crops` for desktop (6:1), mobile (3:1) and tv (16:9). Answers 202: the channel keeps its image until `channel.image.ready` arrives on `GET /v1/me/events`, or `channel.image.failed`. Completing the same upload again answers the same version.',
  params: ImageKindParamSchema,
  body: CompleteImageBodySchema,
  status: 202,
  result: QueuedImageSchema,
  errors: {
    ...CHANNEL_WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND, ErrorCodes.IMAGE_UPLOAD_NOT_FOUND],
    422: [
      ErrorCodes.VALIDATION_FAILED,
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UPLOAD_SIZE_MISMATCH,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.IMAGE_TOO_SMALL,
    ],
  },
});

export const getChannelSpotlight = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/spotlight',
  tag: 'Channels',
  summary: 'The video a channel page shows first, for this viewer',
  description:
    'A subscriber gets the returning-subscriber video, the trailer when none is set; anyone else gets the trailer. A localized trailer for the negotiated locale wins over the default. A video that turned private, is not ready or was deleted drops out on this read, with no save. The only viewer-dependent block of a channel page, so the rest stays cacheable. Anonymous access permitted.',
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: z.object({ locale: z.string().optional() }),
  status: 200,
  result: SpotlightSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export const getMySpotlight = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/spotlight',
  channelScoped: true,
  tag: 'Channels',
  summary: 'Read the spotlight settings of the acting channel',
  description: 'What `setMySpotlight` stored, as saved, whatever state each video is in since.',
  status: 200,
  result: SpotlightSettingsSchema,
  errors: CHANNEL_WRITE_ERRORS,
});

export const setMySpotlight = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/channel/spotlight',
  channelScoped: true,
  tag: 'Channels',
  summary: 'Set the trailer, the returning-subscriber video and the per-language overrides',
  description:
    'Replaces all three in one write. Every video must be a public, ready video of the acting channel (`INVALID_SPOTLIGHT_VIDEO` names which and why); every locale a supported one, once. Owner, manager and editor.',
  body: SpotlightSettingsSchema,
  status: 200,
  result: SpotlightSettingsSchema,
  errors: {
    ...CHANNEL_WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED],
    422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_SPOTLIGHT_VIDEO],
  },
});

export const revealChannelContact = defineEndpoint({
  method: 'POST',
  path: '/v1/channels/:id/contact-reveal',
  tag: 'Channels',
  summary: "Reveal a channel's contact email",
  description:
    'The address the channel set, to a signed-in caller, at most 20 a day per caller. Answers 404 when the channel has none.',
  params: ChannelIdParamSchema,
  status: 200,
  result: ContactSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type ChannelSpotlight = z.infer<typeof SpotlightSchema>;
export type ChannelSpotlightSettings = z.infer<typeof SpotlightSettingsSchema>;
export type QueuedChannelImage = z.infer<typeof QueuedImageSchema>;
