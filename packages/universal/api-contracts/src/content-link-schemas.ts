import {
  CONTENT_LINK_RELATIONS,
  CONTENT_LINK_STATUSES,
  END_SCREEN_LAYOUTS,
  END_SCREEN_MAX_ITEMS,
  LINK_POLICIES,
  type ContentLinkParams,
  type ContentRef,
  type EndScreenItem,
  type StoredLinkRelation,
} from '@vp/domain';
import { z } from 'zod';

const IdSchema = z.uuid({ error: 'Invalid ID format' });

export const ContentRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('video'), id: IdSchema }),
  z.object({ type: z.literal('clip'), id: IdSchema }),
  z.object({ type: z.literal('post'), id: IdSchema }),
  z.object({ type: z.literal('thread'), id: IdSchema }),
  z.object({ type: z.literal('playlist'), id: IdSchema }),
  z.object({ type: z.literal('live'), id: IdSchema }),
  z.object({ type: z.literal('episode'), playlistId: IdSchema, videoId: IdSchema }),
]) satisfies z.ZodType<ContentRef>;

export const LinkRelationSchema = z.enum(CONTENT_LINK_RELATIONS);

export const StoredLinkRelationSchema = z.enum(
  CONTENT_LINK_RELATIONS.filter(
    (relation): relation is StoredLinkRelation => relation !== 'clip_of'
  ) as [StoredLinkRelation, ...StoredLinkRelation[]]
);

export const LinkStatusSchema = z.enum(CONTENT_LINK_STATUSES);

export const LinkPolicySchema = z.enum(LINK_POLICIES);

const AnchorMsSchema = z.number().int().min(0).nullable();

export const LinkAnchorsSchema = z.object({
  sourceStartMs: AnchorMsSchema,
  sourceEndMs: AnchorMsSchema,
  targetStartMs: AnchorMsSchema,
  targetEndMs: AnchorMsSchema,
});

export const LinkParamsSchema = z.discriminatedUnion('relation', [
  z.object({ relation: z.literal('part_of'), part: z.number().int().positive().nullable() }),
  z.object({ relation: z.literal('translation'), locale: z.string().min(2).max(35) }),
  ...(
    [
      'full_video',
      'previous',
      'follow_up',
      'recap',
      'extended_cut',
      'behind_the_scenes',
      'corrects',
      'response_to',
      'reaction_to',
      'remix_of',
      'discussion',
      'related',
    ] as const
  ).map((relation) => z.object({ relation: z.literal(relation) })),
]) satisfies z.ZodType<ContentLinkParams>;

export const EndScreenItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('content'), ref: ContentRefSchema }),
  z.object({
    type: z.literal('channel_tab'),
    channelId: IdSchema,
    tabId: z.string().min(1).max(64),
  }),
  z.object({ type: z.literal('next_episode') }),
  z.object({ type: z.literal('subscribe') }),
]) satisfies z.ZodType<EndScreenItem>;

export const EndScreenLayoutSchema = z.enum(END_SCREEN_LAYOUTS);

export const EndScreenItemsSchema = z.array(EndScreenItemSchema).max(END_SCREEN_MAX_ITEMS);
