import { LINK_PLATFORMS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { BannerLinkSchema, CropRectSchema } from './channel-images';
import { defineEndpoint } from './endpoint';

export const ChannelLinkSchema = z
  .object({
    label: z.string().describe('1-40 characters of plain text after trimming'),
    url: z.string().describe('An https URL of up to 2048 characters'),
  })
  .meta({ id: 'ChannelLink', description: 'A link the creator lists on the channel About tab' });

const ChannelResourceLinkSchema = ChannelLinkSchema.extend({
  platform: z
    .enum(LINK_PLATFORMS)
    .describe('Read off the URL host; `website` when the host is not a known platform'),
}).meta({ id: 'ChannelResourceLink', description: 'A listed link with the platform it points at' });

export const BannerCropsSchema = z
  .object({ desktop: CropRectSchema, mobile: CropRectSchema, tv: CropRectSchema })
  .describe('Whole pixels of the uploaded image: desktop 6:1, mobile 3:1, tv 16:9');

const AvatarSizesSchema = z
  .object({ '48': z.string(), '72': z.string(), '128': z.string(), '256': z.string() })
  .describe('Public WebP of each square size, by its edge in pixels');

const BannerVariantsSchema = z
  .object({ '1280': z.string(), '2560': z.string() })
  .describe('Public WebP of the target, by its width in pixels');

export const ChannelSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z
    .string()
    .nullable()
    .describe('The default variant (128 px) of the uploaded avatar, else an address set earlier'),
  bannerUrl: z
    .string()
    .nullable()
    .describe(
      'The default variant (desktop, 1280 px) of the uploaded banner, else an address set earlier'
    ),
  avatar: z
    .object({ sizes: AvatarSizesSchema })
    .nullable()
    .describe('Every size of the uploaded avatar; null while the channel has none'),
  banner: z
    .object({
      desktop: BannerVariantsSchema,
      mobile: BannerVariantsSchema,
      tv: BannerVariantsSchema,
    })
    .nullable()
    .describe('Every target of the uploaded banner; null while the channel has none'),
  bannerLink: BannerLinkSchema.nullable().describe(
    'A button shown inside the banner safe area, never over the whole banner'
  ),
  country: z.string().length(2).nullable().describe('ISO 3166-1 alpha-2, as the creator chose'),
  hasContact: z
    .boolean()
    .describe('Whether a contact email is set; the address itself is `revealChannelContact`'),
  brandColor: z
    .string()
    .nullable()
    .describe("The channel accent as #rrggbb, or null for the viewer's own"),
  bio: z
    .string()
    .nullable()
    .describe(
      'The description in the negotiated locale when the channel wrote one, else the default'
    ),
  links: z.array(ChannelResourceLinkSchema).describe('Up to eight, in the order the creator set'),
  subscriberCount: z.number().int(),
  videoCount: z.number().int().nonnegative().describe('Public, ready videos'),
  totalViews: z.number().int().nonnegative().describe('Views of those videos'),
  live: z
    .object({
      liveStreamId: z.uuid(),
      videoId: z.uuid(),
      startedAt: z.iso.datetime(),
    })
    .nullable()
    .describe('The public broadcast the channel is live with now, or null'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OwnerChannelSchema = ChannelSchema.extend({
  bannerCrops: BannerCropsSchema.nullable().describe('The crops of the current banner'),
  contactEmail: z.string().nullable().describe('The address `revealChannelContact` hands out'),
  handleChangeAvailableAt: z.iso
    .datetime()
    .nullable()
    .describe('When the handle may change again; null when it may change now'),
  autoCaptionsDefault: z
    .boolean()
    .describe(
      'Whether videos uploaded from now on get generated captions; shown to the owner only'
    ),
});

export const ChannelCardSchema = z
  .object({
    id: z.uuid(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .meta({
    id: 'ChannelCard',
    description: 'The channel that owns the resource, null for a user without one',
  });

export const ChannelIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid channel ID format' }),
});

export const ChannelHandleParamSchema = z.object({
  idOrHandle: z.string().min(1),
});

const ChannelLocaleQuerySchema = z.object({
  locale: z
    .string()
    .optional()
    .describe('A BCP 47 tag; without it the Accept-Language header decides'),
});

const PublicChannelSchema = ChannelSchema.extend({
  redirectedFrom: z
    .string()
    .nullable()
    .describe('The retired handle the request named, when it resolved to this channel'),
});

export const getChannel = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle',
  tag: 'Channels',
  summary: 'Get public creator channel profile',
  description:
    'Returns public channel details, subscriber count, avatar, banner, and bio by channel UUID or @handle. A handle the channel gave up in the last 90 days resolves to it with `redirectedFrom` set, so a client answers 301 to the new handle. The contact email is never in the resource.',
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: ChannelLocaleQuerySchema,
  status: 200,
  result: PublicChannelSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type Channel = z.infer<typeof ChannelSchema>;
export type PublicChannel = z.infer<typeof PublicChannelSchema>;
export type OwnerChannel = z.infer<typeof OwnerChannelSchema>;
