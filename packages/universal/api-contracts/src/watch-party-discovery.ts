import {
  WATCH_PARTY_DISCOVERY_ACCESS,
  WATCH_PARTY_DISCOVERY_KINDS,
  WATCH_PARTY_DISCOVERY_SIZES,
  WATCH_PARTY_DISCOVERY_SORTS,
  WATCH_PARTY_DISCOVERY_STATUSES,
  WATCH_PARTY_PHASES,
  WATCH_PARTY_STATUSES,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { CursorSchema } from './pagination';
import {
  PartyPersonSchema,
  PartyVideoSchema,
  RosterPreviewSchema,
  WatchPartyPlaybackSchema,
} from './watch-party-resource';

const WATCH_PARTY_DISCOVERY_PAGE = { default: 24, max: 48 } as const;

const PartyFlagSchema = z.stringbool().default(false);

const ListWatchPartiesQuerySchema = z.object({
  q: z
    .string()
    .max(200)
    .optional()
    .describe('Room name, owner handle or name, current video title; read as a web search'),
  status: z.enum(WATCH_PARTY_DISCOVERY_STATUSES).default('all'),
  category: z.uuid().optional().describe("The current video's category"),
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .optional()
    .describe("The room's language, a BCP 47 primary subtag"),
  access: z.enum(WATCH_PARTY_DISCOVERY_ACCESS).default('any'),
  size: z.enum(WATCH_PARTY_DISCOVERY_SIZES).default('any'),
  space: PartyFlagSchema.describe('Only rooms with a seat free'),
  followed: PartyFlagSchema.describe(
    'Only rooms whose owner, or a member present, has a channel the caller subscribes to; ignored signed out'
  ),
  creator: PartyFlagSchema.describe('Only rooms hosted as a channel'),
  kind: z.enum(WATCH_PARTY_DISCOVERY_KINDS).default('any'),
  sort: z
    .enum(WATCH_PARTY_DISCOVERY_SORTS)
    .default('members')
    .describe('starting_soon lists scheduled rooms only'),
  cursor: CursorSchema.optional().describe('Bound to the sort it was minted under'),
  limit: z.coerce
    .number<number>()
    .int()
    .min(1)
    .max(WATCH_PARTY_DISCOVERY_PAGE.max)
    .default(WATCH_PARTY_DISCOVERY_PAGE.default),
});

const WatchPartyCardSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    owner: PartyPersonSchema,
    channel: ChannelCardSchema.nullable().describe('Set when the room is hosted as a channel'),
    hasPassword: z.boolean(),
    allowGuests: z.boolean(),
    capacity: z.number().int().nullable(),
    effectiveCapacity: z.number().int(),
    language: z.string().nullable(),
    accent: z.string().nullable(),
    scheduledFor: z.iso.datetime().nullable(),
    phase: z.enum(WATCH_PARTY_PHASES),
    status: z.enum(WATCH_PARTY_STATUSES),
    currentVideo: PartyVideoSchema.extend({ categoryId: z.uuid().nullable() }).nullable(),
    queueLength: z.number().int().nonnegative(),
    presentCount: z.number().int().nonnegative(),
    roster: RosterPreviewSchema,
    playback: WatchPartyPlaybackSchema,
    serverNow: z.number().int().describe('Epoch ms the playback snapshot was read at'),
    createdAt: z.iso.datetime(),
  })
  .meta({
    id: 'WatchPartyCard',
    description:
      'A listed room: every field the discovery filters read, so a client can match a room it was pushed',
  });

export const listWatchParties = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties',
  tag: 'Watch parties',
  summary: 'Discover watch parties',
  description:
    'The open public rooms, filtered and sorted, a keyset page at a time. Private, unlisted, hidden and closed rooms never appear, nor rooms playing a video that is not public, nor one the caller is banned from. Counts move between pages, so a members walk can repeat a room.',
  anonymous: true,
  query: ListWatchPartiesQuerySchema,
  status: 200,
  result: z.object({
    items: z.array(WatchPartyCardSchema),
    nextCursor: z.string().nullable(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export const WatchPartyDiscoveryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('party.counts'),
    payload: z.object({
      counts: z.array(z.object({ id: z.uuid(), presentCount: z.number().int().nonnegative() })),
    }),
  }),
  z.object({ type: z.literal('party.opened'), payload: z.object({ card: WatchPartyCardSchema }) }),
  z.object({ type: z.literal('party.updated'), payload: z.object({ card: WatchPartyCardSchema }) }),
  z.object({ type: z.literal('party.closed'), payload: z.object({ id: z.uuid() }) }),
]);

export type WatchPartyDiscoveryEvent = z.infer<typeof WatchPartyDiscoveryEventSchema>;
export type WatchPartyCardView = z.infer<typeof WatchPartyCardSchema>;
export type ListWatchPartiesQuery = z.infer<typeof ListWatchPartiesQuerySchema>;

export const streamWatchPartyEvents = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/events',
  tag: 'Watch parties',
  summary: 'SSE stream of discovery changes',
  description:
    'Anonymous. party.counts (the present counts that changed, batched every 2 seconds), party.opened and party.updated (a card) and party.closed (an id). Four streams per IP.',
  anonymous: true,
  status: 200,
  result: WatchPartyDiscoveryEventSchema.describe(
    'text/event-stream: each frame is named by its type and carries its payload as data'
  ),
  errors: {
    429: [ErrorCodes.RATE_LIMITED],
  },
});
