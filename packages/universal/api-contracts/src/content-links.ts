import { BACKLINK_SAMPLE_SIZE, LINK_ORIGINS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import {
  ContentRefSchema,
  LinkAnchorsSchema,
  LinkParamsSchema,
  LinkPolicySchema,
  LinkRelationSchema,
  LinkStatusSchema,
} from './content-link-schemas';
import { defineEndpoint } from './endpoint';
import { VideoFormatSchema } from './video-resource';

const LinkIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid link ID format' }) });

const LinkedItemSchema = z.object({
  ref: ContentRefSchema,
  title: z.string(),
  channelId: z.uuid(),
  mediaVideoId: z.uuid().nullable().describe('The video a chip or card plays, when there is one'),
  durationMs: z.number().int().nonnegative().nullable(),
  format: VideoFormatSchema.nullable(),
  progress: z
    .object({
      progressSeconds: z.number().nonnegative(),
      durationSeconds: z.number().nonnegative(),
    })
    .nullable()
    .describe("The signed-in viewer's own playhead on the media video, from their watch history"),
});

const LinkEndsSchema = z.object({
  id: z.uuid(),
  params: LinkParamsSchema,
  anchors: LinkAnchorsSchema.describe('Clamped to the current duration of each end'),
  item: LinkedItemSchema.describe('The other end'),
});

const OutgoingGroupSchema = z.object({
  relation: LinkRelationSchema,
  links: z.array(LinkEndsSchema),
});

const IncomingGroupSchema = z.object({
  relation: LinkRelationSchema,
  count: z.number().int().positive().describe('Visible links only; the client shows "99+" past 99'),
  samples: z.array(LinkEndsSchema).max(BACKLINK_SAMPLE_SIZE),
});

const LinkedContentSchema = z.object({
  ref: ContentRefSchema,
  outgoing: z.array(OutgoingGroupSchema),
  incoming: z.array(IncomingGroupSchema),
});

const LinkLookupBodySchema = z.object({
  refs: z.array(ContentRefSchema).min(1).max(50),
});

const LinkLookupResultSchema = z.object({ items: z.array(LinkedContentSchema) });

const ContentLinkSchema = z.object({
  id: z.uuid(),
  source: ContentRefSchema,
  target: ContentRefSchema,
  params: LinkParamsSchema,
  anchors: LinkAnchorsSchema,
  status: LinkStatusSchema,
  sourceChannelId: z.uuid(),
  targetChannelId: z.uuid(),
  origin: z.enum(LINK_ORIGINS),
  createdBy: z.uuid().nullable().describe('Null once the author deleted their account'),
  decidedBy: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  sourceTitle: z.string().nullable().describe('Null when the viewer cannot see that end'),
  targetTitle: z.string().nullable().describe('Null when the viewer cannot see that end'),
  stats: z
    .object({
      impressions: z.number().int().nonnegative(),
      clicks: z.number().int().nonnegative(),
      watchSeconds: z.number().nonnegative(),
    })
    .nullable()
    .describe('Null without the analytics ability'),
});

const CreateLinkBodySchema = z.object({
  source: ContentRefSchema,
  target: ContentRefSchema,
  params: LinkParamsSchema,
  anchors: LinkAnchorsSchema.optional(),
});

const LINK_LIST_VIEWS = ['requests', 'suggestions', 'fixups', 'all'] as const;

const ListLinksQuerySchema = z.object({
  view: z
    .enum(LINK_LIST_VIEWS)
    .default('all')
    .describe(
      'requests: pending links into this channel; suggestions: viewer suggestions on this channel; fixups: broken links and links whose target is no longer public; all: every link of this channel'
    ),
});

const ListLinksResultSchema = z.object({ items: z.array(ContentLinkSchema) });

const SuggestedLinkSchema = z.object({
  key: z.string().describe('Identifies the suggestion for a dismissal'),
  source: ContentRefSchema,
  target: ContentRefSchema,
  params: LinkParamsSchema,
  anchors: LinkAnchorsSchema,
  signal: z.enum(['watch_url', 'series_order', 'short_and_long', 'video_share']),
  reason: z.string().describe('Why this link is suggested, stated for the creator'),
});

const SuggestedLinksResultSchema = z.object({ items: z.array(SuggestedLinkSchema) });

const DismissSuggestionBodySchema = z.object({ key: z.string().min(1).max(300) });

const LinkPolicyBodySchema = z.object({ policy: LinkPolicySchema });

const LinkPolicyResultSchema = z.object({ policy: LinkPolicySchema });

const LinkStatsResultSchema = z.object({
  items: z.array(
    z.object({
      linkId: z.uuid(),
      impressions: z.number().int().nonnegative(),
      clicks: z.number().int().nonnegative(),
      watchSeconds: z.number().nonnegative(),
    })
  ),
});

const SUGGEST_ACCEPTED = z.object({ accepted: z.literal(true) });

const writeErrors = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN, ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED],
  404: [ErrorCodes.CONTENT_LINK_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND],
} as const;

export const lookupContentLinks = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links/lookup',
  tag: 'Content links',
  summary: 'Read the links of many items in one call',
  description:
    "The only read path of the link graph. For each item: its outgoing links grouped by relation, and the incoming ones as counts and the first five by reverse label. A link is listed only when the viewer can see its other end, so a private, unlisted, held or unready end never appears in a link, a title, a count or a sample. A signed-in viewer's own playhead is attached to each linked video. Up to 50 items. Anonymous access permitted.",
  anonymous: true,
  body: LinkLookupBodySchema,
  status: 200,
  result: LinkLookupResultSchema,
  errors: { 400: [ErrorCodes.VALIDATION_FAILED] },
});

export const createContentLink = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Link one item of the channel to another',
  description:
    "Links content of the acting channel (the source) to another item. Inside the channel the link is active at once. Across channels the target channel's link policy decides: allow activates it, approve leaves it pending in the target's queue, block refuses it. Owner, manager and editor may link.",
  body: CreateLinkBodySchema,
  status: 201,
  result: ContentLinkSchema,
  errors: {
    ...writeErrors,
    409: [ErrorCodes.LINK_EXISTS, ErrorCodes.LINK_LIMIT],
    422: [
      ErrorCodes.LINK_PAIR_NOT_ALLOWED,
      ErrorCodes.LINK_RELATION_SAME_CHANNEL,
      ErrorCodes.LINK_TARGET_BLOCKS,
      ErrorCodes.LINK_TARGET_NOT_PUBLIC,
      ErrorCodes.LINK_SELF,
      ErrorCodes.LINK_LOOP,
      ErrorCodes.LINK_ANCHOR_INVALID,
    ],
  },
});

export const suggestContentLink = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links/suggest',
  tag: 'Content links',
  summary: 'Suggest a link between two public videos',
  description:
    'Any signed-in viewer may propose a link. It is stored as a suggestion and lands once in the source channel queue; one open suggestion per viewer, source, target and relation, and 10 a day. A viewer who is shadow banned on the source channel gets the same answer and nothing is stored; a banned one is refused. There is no free text.',
  body: CreateLinkBodySchema,
  status: 202,
  result: SUGGEST_ACCEPTED,
  errors: {
    ...writeErrors,
    409: [ErrorCodes.LINK_EXISTS],
    422: [
      ErrorCodes.LINK_PAIR_NOT_ALLOWED,
      ErrorCodes.LINK_TARGET_NOT_PUBLIC,
      ErrorCodes.LINK_SELF,
      ErrorCodes.LINK_ANCHOR_INVALID,
    ],
    429: [ErrorCodes.LINK_SUGGESTION_LIMIT],
  },
});

export const approveContentLink = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links/:id/approve',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Approve a pending link into this channel',
  description:
    "Owner or manager of the target channel. The requester is told. For a viewer's suggestion on the acting channel use accept instead.",
  params: LinkIdParamSchema,
  status: 200,
  result: ContentLinkSchema,
  errors: writeErrors,
});

export const declineContentLink = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links/:id/decline',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Decline a pending link or a viewer suggestion',
  description:
    "Owner or manager of the target channel for a pending link, owner, manager or editor of the source channel for a viewer's suggestion.",
  params: LinkIdParamSchema,
  status: 200,
  result: ContentLinkSchema,
  errors: writeErrors,
});

export const acceptContentLinkSuggestion = defineEndpoint({
  method: 'POST',
  path: '/v1/content-links/:id/accept',
  channelScoped: true,
  tag: 'Content links',
  summary: "Accept a viewer's suggestion as a creator link",
  description:
    "Makes the suggestion a creator link of the acting (source) channel. Across channels the target channel's policy then applies, so the result may be pending or refused.",
  params: LinkIdParamSchema,
  status: 200,
  result: ContentLinkSchema,
  errors: {
    ...writeErrors,
    409: [ErrorCodes.LINK_LIMIT],
    422: [ErrorCodes.LINK_TARGET_BLOCKS, ErrorCodes.LINK_TARGET_NOT_PUBLIC, ErrorCodes.LINK_LOOP],
  },
});

export const removeContentLink = defineEndpoint({
  method: 'DELETE',
  path: '/v1/content-links/:id',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Remove a link',
  description:
    "The source channel's owner, manager or editor remove their own link; the target channel's owner or manager remove an inbound one at any time.",
  params: LinkIdParamSchema,
  status: 204,
  result: z.undefined(),
  errors: writeErrors,
});

export const listCreatorContentLinks = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/content-links',
  channelScoped: true,
  tag: 'Content links',
  summary: "List the acting channel's links and queues",
  description:
    'Requests, viewer suggestions, fix-ups or every link, newest first, up to 200. Stats are filled only for members with the analytics ability.',
  query: ListLinksQuerySchema,
  status: 200,
  result: ListLinksResultSchema,
  errors: writeErrors,
});

export const listLinkSuggestions = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/content-links/suggestions',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Suggested links over the last 200 items',
  description:
    'Computed on demand from four signals the platform already has, each with a stated reason, minus the dismissed ones. No model.',
  status: 200,
  result: SuggestedLinksResultSchema,
  errors: writeErrors,
});

export const dismissLinkSuggestion = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/content-links/suggestions/dismiss',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Dismiss a suggested link',
  description: 'Remembered for the channel, so the suggestion does not come back.',
  body: DismissSuggestionBodySchema,
  status: 204,
  result: z.undefined(),
  errors: writeErrors,
});

export const getContentLinkStats = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/content-links/stats',
  channelScoped: true,
  tag: 'Content links',
  summary: 'Impressions, clicks and watch seconds per link',
  description: 'Every link of the acting channel with its totals. Requires the analytics ability.',
  status: 200,
  result: LinkStatsResultSchema,
  errors: writeErrors,
});

export const getLinkPolicy = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/content-links/policy',
  channelScoped: true,
  tag: 'Content links',
  summary: "Read the acting channel's cross-channel link policy",
  description: 'allow, approve (the default) or block.',
  status: 200,
  result: LinkPolicyResultSchema,
  errors: writeErrors,
});

export const setLinkPolicy = defineEndpoint({
  method: 'PUT',
  path: '/v1/creator/content-links/policy',
  channelScoped: true,
  tag: 'Content links',
  summary: "Set the acting channel's cross-channel link policy",
  description: 'Owner and manager only.',
  body: LinkPolicyBodySchema,
  status: 200,
  result: LinkPolicyResultSchema,
  errors: writeErrors,
});

export type LinkedContent = z.infer<typeof LinkedContentSchema>;
export type LinkedItem = z.infer<typeof LinkedItemSchema>;
export type LinkEnds = z.infer<typeof LinkEndsSchema>;
export type ContentLinkView = z.infer<typeof ContentLinkSchema>;
export type SuggestedLink = z.infer<typeof SuggestedLinkSchema>;
export type CreateLinkBody = z.infer<typeof CreateLinkBodySchema>;
export type LinkListView = (typeof LINK_LIST_VIEWS)[number];
