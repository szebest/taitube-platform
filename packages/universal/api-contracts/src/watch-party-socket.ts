import {
  MEMBER_KINDS,
  WATCH_PARTY_CLOSE_REASONS,
  WATCH_PARTY_REACTIONS,
  WATCH_PARTY_RATES,
  WATCH_PARTY_REQUEST_KINDS,
  WATCH_PARTY_STATE_REASONS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { CHAT_MESSAGE_BOUNDS } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { ProblemSchema } from './problem';
import {
  MemberKeySchema,
  PartyChatMessageSchema,
  PartyQueueSchema,
  RosterEntrySchema,
  WatchPartyIdParamSchema,
  WatchPartyPlaybackSchema,
  WatchPartyRoleSchema,
  WatchPartySchema,
} from './watch-party-resource';

/** The sender's own correlation id, echoed on the ack or the error a frame earns. */
const RefSchema = z.string().max(64).optional();
const PositionSchema = z.number().nonnegative();
/** Both fencing tokens the sender saw: a command racing a newer state or a role change is stale. */
const Versions = { ref: RefSchema, version: z.number().int(), rolesVersion: z.number().int() };
const ReactionSchema = z.enum(WATCH_PARTY_REACTIONS);

const frame = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ type: z.literal(type), ref: RefSchema, ...shape });

export const WatchPartyClientFrameSchema = z.discriminatedUnion('type', [
  frame('clock', { t0: z.number() }),
  frame('play', Versions),
  frame('pause', { ...Versions, positionMs: PositionSchema }),
  frame('seek', { ...Versions, positionMs: PositionSchema }),
  frame('rate', { ...Versions, rate: z.union(WATCH_PARTY_RATES.map((rate) => z.literal(rate))) }),
  frame('next', Versions),
  frame('start', Versions),
  frame('ended', { ...Versions, itemId: z.uuid() }),
  frame('ready', { ready: z.boolean() }),
  frame('buffering', { buffering: z.boolean() }),
  frame('away', { away: z.boolean() }),
  frame('skipVote', { itemId: z.uuid() }),
  frame('request', {
    kind: z.enum(WATCH_PARTY_REQUEST_KINDS),
    positionMs: PositionSchema.optional(),
  }),
  frame('chat.send', { message: z.string().max(CHAT_MESSAGE_BOUNDS.maxLength * 4) }),
  frame('chat.remove', { id: z.uuid() }),
  frame('chat.pin', { id: z.uuid().nullable() }),
  frame('react', { emoji: ReactionSchema }),
  frame('stats', {
    driftMs: z.number().nonnegative().max(3_600_000),
    hardSeeks: z.number().int().nonnegative().max(10_000),
  }),
]);

const YouSchema = z.object({
  memberKey: MemberKeySchema,
  kind: z.enum(MEMBER_KINDS),
  roleIds: z.array(z.uuid()),
});

const ChatModeSchema = z.object({ enabled: z.boolean(), slowModeSeconds: z.number().int() });

/** What every socket in the room hears, from whichever pod the change happened on. */
const WatchPartyBroadcastSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('state'),
    playback: WatchPartyPlaybackSchema,
    version: z.number().int(),
    by: MemberKeySchema.nullable().describe('null when the room itself acted'),
    reason: z.enum(WATCH_PARTY_STATE_REASONS),
  }),
  z.object({ type: z.literal('countdown'), startsAt: z.number().int() }),
  z.object({ type: z.literal('queue'), ...PartyQueueSchema.shape }),
  z.object({
    type: z.literal('votes'),
    itemId: z.uuid(),
    votes: z.number().int(),
    needed: z.number().int(),
  }),
  z.object({ type: z.literal('chat.message'), message: PartyChatMessageSchema }),
  z.object({ type: z.literal('chat.removed'), id: z.uuid() }),
  z.object({ type: z.literal('chat.pinned'), message: PartyChatMessageSchema.nullable() }),
  z.object({ type: z.literal('chat.mode'), mode: ChatModeSchema }),
  z.object({
    type: z.literal('reactions'),
    counts: z.partialRecord(ReactionSchema, z.number().int().positive()),
    from: z.array(
      z.object({ memberKey: MemberKeySchema, emoji: ReactionSchema, count: z.number().int() })
    ),
  }),
  z.object({
    type: z.literal('roster.patch'),
    upserts: z.array(RosterEntrySchema),
    removals: z.array(MemberKeySchema),
    guests: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('settings'), room: WatchPartySchema }),
  z.object({
    type: z.literal('roles'),
    roles: z.array(WatchPartyRoleSchema),
    rolesVersion: z.number().int(),
  }),
  z.object({
    type: z.literal('member.roles'),
    memberKey: MemberKeySchema,
    roleIds: z.array(z.uuid()),
    expiries: z.record(z.uuid(), z.iso.datetime().nullable()),
    rolesVersion: z.number().int(),
  }),
  z.object({
    type: z.literal('owner'),
    memberKey: MemberKeySchema,
    rolesVersion: z.number().int(),
  }),
  z.object({ type: z.literal('closed'), reason: z.enum(WATCH_PARTY_CLOSE_REASONS) }),
]);

/**
 * `fresh` sent the latest lines, `replayed` every line after `?after=`, `expired` could not (too many
 * followed), so the client replaces what it shows with the latest lines that follow.
 */
const HelloSchema = z.object({
  type: z.literal('hello'),
  room: WatchPartySchema,
  roles: z.array(WatchPartyRoleSchema),
  rolesVersion: z.number().int(),
  you: YouSchema,
  playback: WatchPartyPlaybackSchema,
  version: z.number().int(),
  serverNow: z.number().int(),
  queue: PartyQueueSchema,
  roster: z.object({ entries: z.array(RosterEntrySchema), guests: z.number().int() }),
  chat: z.object({
    resume: z.enum(['fresh', 'replayed', 'expired']),
    mode: ChatModeSchema,
    pinned: PartyChatMessageSchema.nullable(),
  }),
});

/** Only to the sockets whose holder may act on it. */
const DirectFrameSchemas = [
  HelloSchema,
  z.object({ type: z.literal('clock'), t0: z.number(), serverNow: z.number().int() }),
  z.object({
    type: z.literal('request'),
    from: MemberKeySchema,
    kind: z.enum(WATCH_PARTY_REQUEST_KINDS),
    positionMs: PositionSchema.optional(),
  }),
  z.object({ type: z.literal('you'), ...YouSchema.shape }),
  z.object({ type: z.literal('ack'), ref: RefSchema }),
  z.object({ type: z.literal('error'), ref: RefSchema, problem: ProblemSchema }),
  z.object({ type: z.literal('kicked') }),
  z.object({ type: z.literal('superseded') }),
] as const;

const WatchPartyServerFrameSchema = z
  .discriminatedUnion('type', [...DirectFrameSchemas, ...WatchPartyBroadcastSchema.options])
  .describe(
    'WebSocket text frames, each one JSON object: hello first, the chat backlog as chat.message frames, then live ones'
  );

export const createWatchPartySocketTicket = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/socket-ticket',
  tag: 'Watch parties',
  summary: 'Get a room socket ticket',
  description:
    'A one-time ticket, valid 30 s, the room socket opens with. Members only; an account, a guest or a Discord member alike.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 201,
  result: z.object({ ticket: z.string(), expiresAt: z.iso.datetime() }),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [ErrorCodes.WATCH_PARTY_BANNED],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    503: [ErrorCodes.CACHE_UNAVAILABLE],
  },
});

export const watchPartySocket = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/socket',
  tag: 'Watch parties',
  summary: 'Room socket',
  description:
    'Upgrades to a WebSocket carrying sync, chat, reactions, the roster, roles and requests. Every pod fans changes out through Redis. A refused upgrade answers with a Problem instead.',
  anonymous: true,
  socket: true,
  params: WatchPartyIdParamSchema,
  query: z.object({
    ticket: z.string().max(128).describe('From the ticket endpoint; one use'),
    after: z.uuid().optional().describe('The last chat line this client has'),
  }),
  status: 101,
  result: WatchPartyServerFrameSchema,
  errors: {
    401: [ErrorCodes.WATCH_PARTY_TICKET_INVALID],
    403: [ErrorCodes.WATCH_PARTY_BANNED],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_FULL],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    503: [ErrorCodes.CACHE_UNAVAILABLE, ErrorCodes.DATABASE_UNAVAILABLE],
  },
});

export type WatchPartyClientFrame = z.infer<typeof WatchPartyClientFrameSchema>;
export type WatchPartyServerFrame = z.infer<typeof WatchPartyServerFrameSchema>;
