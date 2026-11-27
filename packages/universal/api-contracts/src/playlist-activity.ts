import { PLAYLIST_ACTIVITY_RETENTION_DAYS, PLAYLIST_COLLABORATOR_ROLES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const RoleSchema = z.enum(PLAYLIST_COLLABORATOR_ROLES);

const RemovedItemSchema = z.object({
  itemId: z.uuid(),
  videoId: z.uuid().nullable(),
  title: z.string().nullable().describe("A section's title; null for a video"),
  addedBy: z.uuid().nullable(),
  note: z.string().nullable(),
  startMs: z.number().int().nullable(),
  endMs: z.number().int().nullable(),
});

const fields = {
  id: z.uuid(),
  actorUserId: z.uuid().nullable().describe('null once their account is gone'),
  actor: ChannelCardSchema.nullable().describe("The actor's primary channel"),
  createdAt: z.iso.datetime().describe('A coalesced reorder carries the time of its latest move'),
};

const entry = <A extends string, T extends z.ZodType>(action: A, target: T) =>
  z.object({ ...fields, action: z.literal(action), target });

const PlaylistActivitySchema = z.discriminatedUnion('action', [
  entry('item_added', z.object({ itemId: z.uuid(), videoId: z.uuid() })),
  entry('item_removed', RemovedItemSchema),
  entry('auto_removed', RemovedItemSchema),
  entry('items_reordered', z.object({ count: z.number().int().nonnegative() })),
  entry('note_edited', z.object({ itemId: z.uuid() })),
  entry('section_added', z.object({ itemId: z.uuid(), title: z.string() })),
  entry('collaborator_added', z.object({ userId: z.uuid(), role: RoleSchema })),
  entry('collaborator_removed', z.object({ userId: z.uuid() })),
  entry('role_changed', z.object({ userId: z.uuid(), role: RoleSchema })),
  entry('settings_changed', z.object({ fields: z.array(z.string()) })),
  entry('restored', z.object({ activityId: z.uuid(), itemId: z.uuid() })),
]);

const OWNER_AND_SEATS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

export const listPlaylistActivity = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/activity',
  tag: 'Playlists',
  summary: 'Read the activity of a playlist',
  description: `Every change to the playlist, newest first, for its owner and collaborators. A run of reorders by one person within five minutes is one entry; entries older than ${PLAYLIST_ACTIVITY_RETENTION_DAYS} days are gone.`,
  params: PlaylistParamSchema,
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(PlaylistActivitySchema), nextCursor: z.string().nullable() }),
  errors: { ...OWNER_AND_SEATS, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const restorePlaylistActivity = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/activity/:activityId/restore',
  tag: 'Playlists',
  summary: 'Restore a removed item',
  description:
    'The owner puts an item a removal took out back at the end, with its adder, note and segment. Restoring a video the playlist holds again answers 409.',
  params: PlaylistParamSchema.extend({
    activityId: z.uuid({ error: 'Invalid activity ID format' }),
  }),
  status: 204,
  result: z.null().describe('Item restored'),
  errors: {
    ...OWNER_AND_SEATS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND],
    409: [ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE],
  },
});

export type PlaylistActivityView = z.infer<typeof PlaylistActivitySchema>;
