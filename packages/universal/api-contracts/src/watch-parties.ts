import {
  WATCH_PARTY_BUFFER_POLICIES,
  WATCH_PARTY_IDLE_CLOSE,
  WATCH_PARTY_JOIN_STATES,
  WATCH_PARTY_LIMITS,
  WATCH_PARTY_PRESETS,
  WATCH_PARTY_PREVIEW_ACTIONS,
  WATCH_PARTY_SLOW_MODE_SECONDS,
  WATCH_PARTY_VISIBILITIES,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ROOM_NAME_BOUNDS, ROOM_PASSWORD_BOUNDS } from '@vp/validation';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import {
  AccentSchema,
  MembershipSchema,
  RosterEntrySchema,
  RosterPreviewSchema,
  WatchPartyIdParamSchema,
  WatchPartyPermissionSchema,
  WatchPartySchema,
} from './watch-party-resource';

const { skipVotePercent } = WATCH_PARTY_LIMITS;

/** Shape only: lengths, links, the capacity ceiling and the schedule window are the API's rules. */
const SettingsSchema = z.object({
  name: z.string().max(ROOM_NAME_BOUNDS.maxLength * 4),
  visibility: z.enum(WATCH_PARTY_VISIBILITIES),
  password: z.string().max(ROOM_PASSWORD_BOUNDS.maxLength * 4),
  capacity: z.number().int().nullable(),
  allowGuests: z.boolean(),
  chatEnabled: z.boolean(),
  slowModeSeconds: z.union(WATCH_PARTY_SLOW_MODE_SECONDS.map((seconds) => z.literal(seconds))),
  bufferPolicy: z.enum(WATCH_PARTY_BUFFER_POLICIES),
  autoplay: z.boolean(),
  skipVotePercent: z.number().int().min(skipVotePercent.min).max(skipVotePercent.max),
  idleClose: z.enum(WATCH_PARTY_IDLE_CLOSE),
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .nullable()
    .describe('BCP 47 primary subtag'),
  accent: AccentSchema.nullable(),
  scheduledFor: z.iso.datetime().nullable(),
  autoStart: z.boolean(),
});

const RoomSourceSchema = z.union([
  z.object({ videoId: z.uuid(), startMs: z.number().int().nonnegative().optional() }),
  z.object({ playlistId: z.uuid() }),
  z.object({
    videoIds: z.array(z.uuid()).min(1).max(WATCH_PARTY_LIMITS.queueItems),
    startIndex: z.number().int().nonnegative().optional(),
  }),
]);

const CreateWatchPartyBodySchema = SettingsSchema.partial().extend({
  visibility: z.enum(WATCH_PARTY_VISIBILITIES),
  preset: z.enum(WATCH_PARTY_PRESETS),
  hostAs: z.enum(['user', 'channel']).default('user'),
  source: RoomSourceSchema.optional(),
  reuse: z.boolean().optional().describe("Reuse the caller's unstarted room for the same source"),
});

const PatchWatchPartyBodySchema = SettingsSchema.partial().extend({
  password: SettingsSchema.shape.password.nullable().optional().describe('null clears it'),
  version: z.number().int(),
});

export const createWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties',
  tag: 'Watch parties',
  summary: 'Create a watch party',
  description:
    'Creates a room in the lobby with the eleven built-in roles, Member set by the preset, and the queue from the source.',
  body: CreateWatchPartyBodySchema,
  status: 201,
  result: WatchPartySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    409: [ErrorCodes.WATCH_PARTY_LIMIT_REACHED],
    422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

const WatchPartyPreviewSchema = WatchPartySchema.extend({
  features: z.object({ voice: z.boolean() }),
  roster: RosterPreviewSchema,
  viewer: z.object({
    memberKey: z.string().nullable(),
    permissions: z.array(WatchPartyPermissionSchema),
    roleIds: z.array(z.uuid()),
    canJoin: z.enum(WATCH_PARTY_JOIN_STATES),
    actions: z.array(z.enum(WATCH_PARTY_PREVIEW_ACTIONS)),
  }),
}).meta({ id: 'WatchPartyPreview', description: 'A room as a visitor or a member sees it' });

export const getWatchParty = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id',
  tag: 'Watch parties',
  summary: 'Read a watch party',
  description:
    'The room preview. A private room answers 404 to anyone without a seat or a grant, as if it did not exist.',
  anonymous: true,
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  query: z.object({ invite: z.string().max(128).optional() }).optional(),
  status: 200,
  result: WatchPartyPreviewSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const updateWatchParty = defineEndpoint({
  method: 'PATCH',
  path: '/v1/watch-parties/:id',
  tag: 'Watch parties',
  summary: 'Edit a watch party',
  description:
    'Changes the given settings (room.edit; the schedule needs room.schedule) against the version read. Sockets get a settings frame.',
  params: WatchPartyIdParamSchema,
  body: PatchWatchPartyBodySchema,
  status: 200,
  result: WatchPartySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE],
  },
});

export const closeWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/close',
  tag: 'Watch parties',
  summary: 'Close a watch party',
  description: 'Ends the room for everyone (room.close). Sockets get closed and are closed.',
  params: WatchPartyIdParamSchema,
  body: z.object({ reason: z.string().max(200).optional() }).nullish(),
  status: 200,
  result: WatchPartySchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
  },
});

const JoinBodySchema = z
  .object({
    password: z
      .string()
      .max(ROOM_PASSWORD_BOUNDS.maxLength * 4)
      .optional(),
    invite: z.string().max(128).optional().describe('An invite id or an invite link token'),
  })
  .nullish();

export const joinWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/join',
  tag: 'Watch parties',
  summary: 'Join a watch party',
  description:
    'Takes a seat: as a member already, by invite, invite link, password or the link alone. Idempotent for a member. An invite skips the password, never the capacity.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  body: JoinBodySchema,
  status: 200,
  result: z.object({ membership: MembershipSchema }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [
      ErrorCodes.WATCH_PARTY_BANNED,
      ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
      ErrorCodes.WATCH_PARTY_PASSWORD_INVALID,
      ErrorCodes.WATCH_PARTY_INVITE_INVALID,
      ErrorCodes.WATCH_PARTY_GUESTS_OFF,
    ],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_FULL],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    429: [ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED],
  },
});

export const leaveWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/leave',
  tag: 'Watch parties',
  summary: 'Leave a watch party',
  description: 'Gives up the seat. The owner leaving keeps ownership through a 60 s grace.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const getWatchPartyRoster = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/roster',
  tag: 'Watch parties',
  summary: 'Read the roster',
  description:
    'Members get the roster, guests counted unless they hold members.kick; anyone else who can read the room gets its preview.',
  anonymous: true,
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 200,
  result: z.discriminatedUnion('view', [
    z.object({
      view: z.literal('members'),
      entries: z.array(RosterEntrySchema),
      guests: z.number().int().nonnegative(),
    }),
    z.object({ view: z.literal('preview'), preview: RosterPreviewSchema }),
  ]),
  errors: {
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

const MyRoomsSchema = z.object({
  owning: z.array(WatchPartySchema),
  joined: z.array(WatchPartySchema),
  interested: z.array(WatchPartySchema),
});

export const listMyWatchParties = defineEndpoint({
  method: 'GET',
  path: '/v1/me/watch-parties',
  tag: 'Watch parties',
  summary: 'My watch parties',
  description: 'The open rooms the caller owns, holds a seat in, or is interested in.',
  status: 200,
  result: MyRoomsSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export type CreateWatchPartyBody = z.infer<typeof CreateWatchPartyBodySchema>;
export type PatchWatchPartyBody = z.infer<typeof PatchWatchPartyBodySchema>;
export type WatchPartyPreviewView = z.infer<typeof WatchPartyPreviewSchema>;
