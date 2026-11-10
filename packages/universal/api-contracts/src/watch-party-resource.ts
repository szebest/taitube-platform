import {
  BUILT_IN_ROLE_KEYS,
  MEMBER_KINDS,
  ROLE_KINDS,
  ROSTER_SOURCES,
  ROSTER_SYNC_STATES,
  ROSTER_VOICE_STATES,
  WATCH_PARTY_BUFFER_POLICIES,
  WATCH_PARTY_CLOSE_REASONS,
  WATCH_PARTY_IDLE_CLOSE,
  WATCH_PARTY_JOIN_PATHS,
  WATCH_PARTY_MESSAGE_SOURCES,
  WATCH_PARTY_PERMISSION_IDS,
  WATCH_PARTY_PHASES,
  WATCH_PARTY_RATES,
  WATCH_PARTY_SLOW_MODE_SECONDS,
  WATCH_PARTY_STATUSES,
  WATCH_PARTY_SYSTEM_EVENTS,
  WATCH_PARTY_VISIBILITIES,
  type WatchPartyPermission,
} from '@vp/domain';
import { ACCENT_PATTERN } from '@vp/domain/settings';
import { z } from 'zod';

export const WatchPartyIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid watch party ID format' }),
});

export const MemberKeySchema = z
  .string()
  .regex(/^(user|discord|guest):[A-Za-z0-9_-]{1,64}$/, { error: 'Invalid member key' })
  .describe('`user:<uuid>`, `discord:<snowflake>` or `guest:<id>`');

export const WatchPartyPermissionSchema = z.enum(
  WATCH_PARTY_PERMISSION_IDS as [WatchPartyPermission, ...WatchPartyPermission[]]
);

export const AccentSchema = z.string().regex(ACCENT_PATTERN).describe('#rrggbb');

export const WatchPartyPlaybackSchema = z
  .object({
    itemId: z.uuid().nullable(),
    phase: z.enum(WATCH_PARTY_PHASES),
    positionMs: z.number().nonnegative(),
    rate: z.union(WATCH_PARTY_RATES.map((rate) => z.literal(rate))),
    anchorAt: z
      .number()
      .int()
      .describe('Epoch ms the position was taken at; ahead of now during a countdown'),
  })
  .meta({
    id: 'WatchPartyPlayback',
    description:
      'The room clock: while playing, the position at t is positionMs + (t - anchorAt) * rate',
  });

const PartyVideoSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  thumbnailUrl: z.string().nullable(),
});

const PartyPersonSchema = z.object({
  memberKey: MemberKeySchema,
  name: z.string(),
  avatarUrl: z.string().nullable(),
});

export const WatchPartySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    owner: PartyPersonSchema,
    asChannelId: z.uuid().nullable().describe('Hosted as this channel'),
    visibility: z.enum(WATCH_PARTY_VISIBILITIES),
    hasPassword: z.boolean(),
    capacity: z.number().int().nullable().describe('null: up to the operator ceiling'),
    effectiveCapacity: z.number().int().describe('What the "12 / 20" count shows'),
    allowGuests: z.boolean(),
    chatEnabled: z.boolean(),
    slowModeSeconds: z.union(WATCH_PARTY_SLOW_MODE_SECONDS.map((seconds) => z.literal(seconds))),
    bufferPolicy: z.enum(WATCH_PARTY_BUFFER_POLICIES),
    autoplay: z.boolean(),
    skipVotePercent: z.number().int(),
    idleClose: z.enum(WATCH_PARTY_IDLE_CLOSE),
    language: z.string().nullable(),
    accent: AccentSchema.nullable(),
    scheduledFor: z.iso.datetime().nullable(),
    autoStart: z.boolean(),
    phase: z.enum(WATCH_PARTY_PHASES),
    currentVideo: PartyVideoSchema.nullable(),
    queueLength: z.number().int().nonnegative(),
    presentCount: z.number().int().nonnegative(),
    status: z.enum(WATCH_PARTY_STATUSES),
    closedReason: z.enum(WATCH_PARTY_CLOSE_REASONS).nullable(),
    version: z.number().int().describe('Sent back on PATCH: a stale one is VERSION_CONFLICT'),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'WatchParty', description: 'A watch party room and its settings' });

export const WatchPartyRoleSchema = z
  .object({
    id: z.uuid(),
    key: z.enum(BUILT_IN_ROLE_KEYS).nullable().describe('The built-in role; null for a custom one'),
    kind: z.enum(ROLE_KINDS).describe('grant adds its permissions; restrict removes them'),
    name: z.string(),
    colour: AccentSchema.nullable(),
    position: z.number().int(),
    permissions: z.array(WatchPartyPermissionSchema),
    memberCount: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime().describe('Sent back on PATCH as the edit guard'),
  })
  .meta({ id: 'WatchPartyRole', description: 'A named, coloured set of room permissions' });

export const RosterEntrySchema = z
  .object({
    memberKey: MemberKeySchema,
    kind: z.enum(MEMBER_KINDS),
    source: z.enum(ROSTER_SOURCES),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    roleIds: z.array(z.uuid()),
    ready: z.boolean(),
    sync: z.enum(ROSTER_SYNC_STATES),
    voice: z.enum(ROSTER_VOICE_STATES),
    away: z.boolean(),
  })
  .meta({ id: 'WatchPartyRosterEntry', description: 'One person in the party' });

export const RosterPreviewSchema = z
  .object({
    faces: z.array(z.object({ name: z.string(), avatarUrl: z.string().nullable() })).max(5),
    others: z.number().int().nonnegative().describe('Accounts not shown as a face'),
    discord: z.number().int().nonnegative(),
    guests: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .meta({
    id: 'WatchPartyRosterPreview',
    description: 'Who is watching, as surfaces outside the room show it',
  });

export const MembershipSchema = z.object({
  roomId: z.uuid(),
  memberKey: MemberKeySchema,
  kind: z.enum(MEMBER_KINDS),
  name: z.string(),
  joinedVia: z.enum(WATCH_PARTY_JOIN_PATHS),
  roleIds: z.array(z.uuid()),
  permissions: z.array(WatchPartyPermissionSchema),
});

const QueueItemSchema = z.object({
  id: z.uuid(),
  video: PartyVideoSchema,
  addedBy: MemberKeySchema,
  startMs: z.number().int().nonnegative(),
  playedAt: z.iso.datetime().nullable(),
});

export const PartyQueueSchema = z
  .object({ items: z.array(QueueItemSchema), version: z.number().int() })
  .meta({ id: 'WatchPartyQueue', description: 'The shared queue in play order' });

export const PartyChatMessageSchema = z
  .object({
    id: z.uuid().describe('UUIDv7: a room sorts its lines by id'),
    author: PartyPersonSchema.nullable().describe('null for a system line'),
    source: z.enum(WATCH_PARTY_MESSAGE_SOURCES),
    kind: z.enum(['text', 'system']),
    body: z.string(),
    system: z
      .object({
        event: z.enum(WATCH_PARTY_SYSTEM_EVENTS),
        actorKey: MemberKeySchema.nullable(),
        targetKey: MemberKeySchema.nullable(),
        detail: z.string().nullable(),
      })
      .nullable(),
    videoId: z.uuid().nullable(),
    positionMs: z.number().int().nonnegative().nullable(),
    pinned: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'WatchPartyChatMessage', description: 'One chat line, or a system line' });

export type WatchPartyView = z.infer<typeof WatchPartySchema>;
export type WatchPartyRoleView = z.infer<typeof WatchPartyRoleSchema>;
export type PartyQueueView = z.infer<typeof PartyQueueSchema>;
