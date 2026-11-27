import { BUILT_IN_TAB_KINDS, LINK_PLATFORMS, LIVE_STREAM_STATUSES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { PresentationSchema, SectionLayoutSchema } from './channel-layout';
import { ChannelCardSchema, ChannelHandleParamSchema } from './channels';
import { defineEndpoint } from './endpoint';

const ItemBase = {
  id: z.uuid(),
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
};

export const PageItemSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      ...ItemBase,
      kind: z.literal('video'),
      format: z.enum(['standard', 'short']),
      durationMs: z.number().int().nullable(),
      viewsCount: z.number().int(),
      likesCount: z.number().int(),
    }),
    z.strictObject({
      ...ItemBase,
      kind: z.literal('post'),
      likesCount: z.number().int(),
      commentsCount: z.number().int(),
    }),
    z.strictObject({ ...ItemBase, kind: z.literal('playlist'), itemCount: z.number().int() }),
    z.strictObject({
      ...ItemBase,
      kind: z.literal('live'),
      status: z.enum(LIVE_STREAM_STATUSES),
      viewers: z.number().int(),
      videoId: z.uuid().nullable().describe('The archive, once the stream ended'),
    }),
    z.strictObject({ kind: z.literal('channel'), channel: ChannelCardSchema }),
  ])
  .meta({ id: 'PageItem', description: 'One card of a section, by what it points at' });

const SectionBase = { id: z.string(), presentation: PresentationSchema };

const ResolvedSectionSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      ...SectionBase,
      kind: z.literal('content'),
      layout: SectionLayoutSchema,
      seeAll: z.string().nullable().describe('The slug of the tab the link opens'),
      items: z.array(PageItemSchema),
    }),
    z.strictObject({ ...SectionBase, kind: z.literal('rich_text'), body: z.string() }),
    z.strictObject({
      ...SectionBase,
      kind: z.literal('links'),
      links: z.array(
        z.strictObject({ label: z.string(), url: z.string(), platform: z.enum(LINK_PLATFORMS) })
      ),
    }),
    z.strictObject({
      ...SectionBase,
      kind: z.literal('featured_channels'),
      items: z.array(PageItemSchema),
    }),
  ])
  .meta({ id: 'ResolvedSection' });

const TabSummarySchema = z.strictObject({
  id: z.string(),
  kind: z.enum([...BUILT_IN_TAB_KINDS, 'custom']),
  title: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
});

const PageImageUrlsSchema = z
  .strictObject({ w640: z.string(), w1280: z.string() })
  .meta({ id: 'PageImageUrls', description: 'The variants of one `page-image`, by width' });

export const ChannelPageSchema = z
  .strictObject({
    channelId: z.uuid(),
    revision: z
      .number()
      .int()
      .nullable()
      .describe('The published revision; null for the default layout'),
    seed: z.string().describe('What `random` orders by; the same seed gives the same order'),
    landing: z.string().describe('The slug of the tab this viewer opens first'),
    tabs: z.array(TabSummarySchema).describe('The tabs this viewer sees, in order'),
    tab: TabSummarySchema.extend({
      description: z.string().nullable(),
      header: z.uuid().nullable(),
      sections: z.array(ResolvedSectionSchema),
    }),
    images: z
      .record(z.uuid(), PageImageUrlsSchema)
      .describe(
        'The ready `page-image` the tab uses (headers, backgrounds, rich text images) by id; one that is not ready is absent'
      ),
  })
  .meta({ id: 'ChannelPage', description: 'A channel page as one viewer sees one tab of it' });

export const ChannelPageQuerySchema = z.object({
  tab: z.string().max(64).optional().describe('A tab slug; without it the viewer landing tab'),
  seed: z
    .string()
    .max(64)
    .optional()
    .describe('Fixes the order of `random` sections for one visit'),
  locale: z
    .string()
    .optional()
    .describe('A BCP 47 tag; without it the Accept-Language header decides'),
});

export const getChannelPage = defineEndpoint({
  method: 'GET',
  path: '/v1/channels/:idOrHandle/page',
  tag: 'Channels',
  summary: 'A channel page, resolved for this viewer',
  description:
    'The landing tab, or the tab named by `tab`, with every visible section of it resolved in one batched read. Sections the viewer audience, locale or window excludes are absent, and so is a section that ends up empty with `hideWhenEmpty` or `hideWatched`. A tab that is hidden, unknown or has nothing to show answers 404. Anonymous access permitted.',
  anonymous: true,
  params: ChannelHandleParamSchema,
  query: ChannelPageQuerySchema,
  status: 200,
  result: ChannelPageSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type ChannelPageView = z.infer<typeof ChannelPageSchema>;
export type PageItemView = z.infer<typeof PageItemSchema>;
export type ResolvedSectionView = z.infer<typeof ResolvedSectionSchema>;
