import { ACCENT_PATTERN } from '@kit/appearance';
import {
  type ChannelLayout,
  CHANNEL_LAYOUT_VERSION,
  GRID_COLUMNS,
  LAYOUT_AUDIENCES,
  LAYOUT_LIMITS,
  PICKED_ITEM_KINDS,
  SECTION_DENSITIES,
  SECTION_SORTS,
} from '@vp/domain';
import { z } from 'zod';
import { PlaylistRulesSchema } from './playlist-rules';

const IdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/)
  .describe('Chosen by the studio; unique among the tabs, and among the sections of the layout');

const LocaleSchema = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

const LocalizedTextSchema = z
  .object({ default: z.string().min(1).max(120) })
  .catchall(z.string().min(1).max(120))
  .describe('A default text plus the text of any locale the app supports, keyed by locale tag');

const InstantSchema = z.iso.datetime();

const VisibilitySchema = z
  .strictObject({
    audience: z
      .enum(LAYOUT_AUDIENCES)
      .describe('visitors: not subscribed, signed in or not; signed_in: any signed-in viewer'),
    from: InstantSchema.nullable(),
    to: InstantSchema.nullable(),
    locales: z.array(LocaleSchema).describe('Empty: every locale'),
  })
  .meta({ id: 'LayoutVisibility' });

export const PresentationSchema = z
  .strictObject({
    title: LocalizedTextSchema.nullable(),
    subtitle: LocalizedTextSchema.nullable(),
    background: z.uuid().nullable().describe('A `page-image` of the channel'),
    accent: z
      .string()
      .regex(ACCENT_PATTERN)
      .nullable()
      .describe('#rrggbb, scoped to the section; the viewer own accent still wins'),
    density: z.enum(SECTION_DENSITIES),
    show: z.strictObject({ duration: z.boolean(), views: z.boolean(), date: z.boolean() }),
  })
  .meta({ id: 'SectionPresentation' });

const SourceSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('videos') }),
    z.strictObject({ type: z.literal('shorts') }),
    z.strictObject({ type: z.literal('posts') }),
    z.strictObject({ type: z.literal('live') }),
    z.strictObject({ type: z.literal('playlists') }),
    z.strictObject({ type: z.literal('playlist'), playlistId: z.uuid() }),
    z.strictObject({
      type: z.literal('picked'),
      items: z
        .array(z.strictObject({ kind: z.enum(PICKED_ITEM_KINDS), id: z.uuid() }))
        .describe(`In display order, at most ${LAYOUT_LIMITS.pickedItems}`),
    }),
    z.strictObject({ type: z.literal('start_here') }),
    z.strictObject({ type: z.literal('smart_playlist'), rules: PlaylistRulesSchema }),
  ])
  .meta({ id: 'SectionSource' });

const FiltersSchema = z
  .strictObject({
    tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(LAYOUT_LIMITS.tags),
    dateRange: z
      .discriminatedUnion('type', [
        z.strictObject({
          type: z.literal('absolute'),
          from: InstantSchema.nullable(),
          to: InstantSchema.nullable(),
        }),
        z.strictObject({
          type: z.literal('last_days'),
          days: z.number().int().positive().max(3650),
        }),
      ])
      .nullable(),
    duration: z
      .strictObject({
        minSeconds: z.number().int().nonnegative().nullable(),
        maxSeconds: z.number().int().positive().nullable(),
      })
      .nullable(),
    hideWatched: z
      .boolean()
      .describe('Applies to a signed-in viewer only; a guest sees everything'),
  })
  .meta({ id: 'SectionFilters' });

export const SectionLayoutSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('shelf') }),
    z.strictObject({
      type: z.literal('grid'),
      columns: z.number().int().min(GRID_COLUMNS.min).max(GRID_COLUMNS.max),
    }),
    z.strictObject({ type: z.literal('list') }),
    z.strictObject({ type: z.literal('hero') }),
    z.strictObject({ type: z.literal('masonry') }),
  ])
  .meta({ id: 'SectionLayout' });

const ContentSectionSchema = z
  .strictObject({
    kind: z.literal('content'),
    id: IdSchema,
    source: SourceSchema,
    filters: FiltersSchema,
    sort: z
      .enum(SECTION_SORTS)
      .describe('manual keeps the source order: picked, one playlist, Start here'),
    layout: SectionLayoutSchema,
    itemCount: z.number().int().min(1).max(LAYOUT_LIMITS.itemCount).describe('1 for a hero'),
    seeAll: IdSchema.nullable().describe('A tab id of this layout'),
    presentation: PresentationSchema,
    visibility: VisibilitySchema,
    hideWhenEmpty: z.boolean(),
  })
  .refine(({ layout, itemCount }) => layout.type !== 'hero' || itemCount === 1, {
    error: 'A hero shows one item',
    path: ['itemCount'],
  })
  .refine(({ layout, source }) => layout.type !== 'masonry' || source.type === 'posts', {
    error: 'Masonry is for posts',
    path: ['layout'],
  })
  .refine(
    ({ sort, source }) =>
      sort !== 'manual' ||
      source.type === 'picked' ||
      source.type === 'playlist' ||
      source.type === 'start_here',
    { error: 'Manual order is for picked items, one playlist and Start here', path: ['sort'] }
  );

const RichTextSectionSchema = z.strictObject({
  kind: z.literal('rich_text'),
  id: IdSchema,
  body: z.string().describe('Limited Markdown, checked against the whitelist on save'),
  presentation: PresentationSchema,
  visibility: VisibilitySchema,
});

const LinksSectionSchema = z.strictObject({
  kind: z.literal('links'),
  id: IdSchema,
  links: z.array(z.strictObject({ label: z.string(), url: z.string() })),
  presentation: PresentationSchema,
  visibility: VisibilitySchema,
});

const FeaturedChannelsSectionSchema = z.strictObject({
  kind: z.literal('featured_channels'),
  id: IdSchema,
  channelIds: z.array(z.uuid()).max(LAYOUT_LIMITS.featuredChannels),
  presentation: PresentationSchema,
  visibility: VisibilitySchema,
});

const SectionSchema = z
  .discriminatedUnion('kind', [
    ContentSectionSchema,
    RichTextSectionSchema,
    LinksSectionSchema,
    FeaturedChannelsSectionSchema,
  ])
  .meta({ id: 'LayoutSection' });

const tabBase = {
  id: IdSchema,
  title: z.string().trim().min(1).max(LAYOUT_LIMITS.tabTitle),
  hidden: z.boolean(),
  visibility: VisibilitySchema,
};

const TabSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ ...tabBase, kind: z.literal('home'), sections: z.array(SectionSchema) }),
    z.strictObject({ ...tabBase, kind: z.literal('videos') }),
    z.strictObject({ ...tabBase, kind: z.literal('shorts') }),
    z.strictObject({ ...tabBase, kind: z.literal('posts') }),
    z.strictObject({ ...tabBase, kind: z.literal('playlists') }),
    z.strictObject({ ...tabBase, kind: z.literal('about') }),
    z.strictObject({
      ...tabBase,
      kind: z.literal('custom'),
      slug: z.string().max(64).describe('3 to 30 of a-z0-9-, checked against the channel on save'),
      icon: z.string().max(40).nullable(),
      description: z.string().max(LAYOUT_LIMITS.tabDescription).nullable(),
      header: z.uuid().nullable().describe('A `page-image` of the channel'),
      sections: z.array(SectionSchema),
    }),
  ])
  .meta({ id: 'LayoutTab' });

export const ChannelLayoutSchema = z
  .strictObject({
    schemaVersion: z.literal(CHANNEL_LAYOUT_VERSION),
    landing: z.strictObject({ visitor: IdSchema, subscriber: IdSchema }),
    tabs: z.array(TabSchema),
  })
  .meta({
    id: 'ChannelLayout',
    description:
      'The versioned document a channel page is built from: tabs, and sections on Home and on custom tabs. Caps (tabs, sections, picked items, size) are refused on save with their own codes.',
  }) satisfies z.ZodType<ChannelLayout>;
