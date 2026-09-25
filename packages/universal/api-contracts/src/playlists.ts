import { PLAYLIST_VISIBILITIES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoSummarySchema } from './video-resource';

const PlaylistIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid playlist ID format' }),
});

const PlaylistVisibilitySchema = z
  .enum(PLAYLIST_VISIBILITIES)
  .describe('public: listed and searchable; unlisted: anyone with the link; private: the owner');

export const ChannelCardSchema = z
  .object({
    id: z.string().uuid(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .describe('The channel that owns the resource, null for a user without one');

const PlaylistItemSchema = z.object({
  id: z.string().uuid().describe('The item id a reorder names'),
  videoId: z.string().uuid(),
  position: z
    .number()
    .int()
    .nonnegative()
    .describe('0-based place in the playlist; a video hidden from this viewer keeps its place'),
  addedAt: z.string().describe('ISO 8601 timestamp the video was added'),
  video: VideoSummarySchema,
  channel: ChannelCardSchema.nullable(),
});

const PlaylistSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  visibility: PlaylistVisibilitySchema,
  isSystem: z.boolean().describe('Watch Later: cannot be renamed or deleted'),
  thumbnailUrl: z.string().nullable().describe('The custom thumbnail, else the first video poster'),
  videoCount: z.number().int().nonnegative().describe('Videos this viewer may watch'),
  owner: ChannelCardSchema.nullable(),
  items: z.array(PlaylistItemSchema),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 timestamp of the last change, items included'),
});

const OwnedPlaylistSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  visibility: PlaylistVisibilitySchema,
  isSystem: z.boolean(),
  videoCount: z.number().int().nonnegative(),
  containsVideo: z.boolean().describe('The playlist holds the videoId asked about'),
  updatedAt: z.string(),
});

const TitleSchema = z.string().describe('1-150 characters of plain text after trimming');
const DescriptionSchema = z.string().describe('Up to 5000 characters of plain text');

const WRITE_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

export const createPlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists',
  tag: 'Playlists',
  summary: 'Create a playlist',
  description: 'Creates an empty playlist owned by the caller, private unless asked otherwise.',
  body: z.object({
    title: TitleSchema,
    description: DescriptionSchema.optional(),
    visibility: PlaylistVisibilitySchema.optional(),
  }),
  status: 201,
  result: PlaylistSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const getPlaylist = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id',
  tag: 'Playlists',
  summary: 'Read a playlist',
  description:
    'The playlist, its owner channel and its items in order. A private playlist of someone else answers 404, as if it did not exist.',
  anonymous: true,
  params: PlaylistIdParamSchema,
  status: 200,
  result: PlaylistSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
  },
});

export const updatePlaylist = defineEndpoint({
  method: 'PATCH',
  path: '/v1/playlists/:id',
  tag: 'Playlists',
  summary: 'Edit a playlist',
  description: 'The owner renames, redescribes or changes the visibility of a playlist.',
  params: PlaylistIdParamSchema,
  body: z.object({
    title: TitleSchema.optional(),
    description: DescriptionSchema.optional(),
    visibility: PlaylistVisibilitySchema.optional(),
  }),
  status: 200,
  result: PlaylistSchema,
  errors: {
    ...WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const deletePlaylist = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id',
  tag: 'Playlists',
  summary: 'Delete a playlist',
  description: 'The owner deletes a playlist and its items. Watch Later cannot be deleted.',
  params: PlaylistIdParamSchema,
  status: 204,
  result: z.null().describe('Playlist deleted'),
  errors: {
    ...WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
  },
});

export const addPlaylistItem = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/items',
  tag: 'Playlists',
  summary: 'Add a video to a playlist',
  description:
    'Appends a video the caller may watch to the end of the playlist. Adding a video already there changes nothing.',
  params: PlaylistIdParamSchema,
  body: z.object({ videoId: z.string().uuid() }),
  status: 201,
  result: PlaylistSchema,
  errors: { ...WRITE_ERRORS, 404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND] },
});

export const removePlaylistItem = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/items/:videoId',
  tag: 'Playlists',
  summary: 'Remove a video from a playlist',
  description:
    'Removes the video; the items after it move up one place. Removing an absent video changes nothing.',
  params: PlaylistIdParamSchema.extend({ videoId: z.string().uuid() }),
  status: 204,
  result: z.null().describe('Video removed'),
  errors: WRITE_ERRORS,
});

const MoveSchema = z
  .object({
    itemId: z.string().uuid(),
    newPosition: z.number().int().nonnegative().describe('Target place; past the end means last'),
  })
  .strict()
  .transform(({ itemId, newPosition }) => ({ type: 'move' as const, itemId, index: newPosition }));

const ReindexSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).describe('Every item id of the playlist, in the new order'),
  })
  .strict()
  .transform(({ itemIds }) => ({ type: 'reindex' as const, itemIds }));

export const reorderPlaylist = defineEndpoint({
  method: 'PUT',
  path: '/v1/playlists/:id/reorder',
  tag: 'Playlists',
  summary: 'Reorder a playlist',
  description:
    'Moves one item to a new place, or puts every item in the order given. A full order that misses or repeats an item was drawn from a stale view and answers 409.',
  params: PlaylistIdParamSchema,
  body: z.union([MoveSchema, ReindexSchema]),
  status: 200,
  result: PlaylistSchema,
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_ITEM_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT],
  },
});

export const listMyPlaylists = defineEndpoint({
  method: 'GET',
  path: '/v1/me/playlists',
  tag: 'Playlists',
  summary: 'List my playlists',
  description:
    'Every playlist the caller owns, Watch Later first, each flagged with whether it holds videoId: the "Save to playlist" dialog in one round trip.',
  query: z.object({ videoId: z.string().uuid().optional() }),
  status: 200,
  result: z.object({ items: z.array(OwnedPlaylistSchema) }),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 401: [ErrorCodes.UNAUTHORIZED] },
});

export type PlaylistView = z.infer<typeof PlaylistSchema>;
export type OwnedPlaylistView = z.infer<typeof OwnedPlaylistSchema>;
export type ChannelCardView = z.infer<typeof ChannelCardSchema>;
