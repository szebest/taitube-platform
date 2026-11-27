import { PLAYLIST_COVER_MODES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import {
  OwnedPlaylistSchema,
  PlaylistKindSchema,
  PlaylistSchema,
  PlaylistVisibilitySchema,
  ShareQuerySchema,
} from './playlist-resource';
import { PlaylistRulesSchema } from './playlist-rules';
import { SHARE_TOKEN_PARAM } from './video-access';

const PlaylistIdParamSchema = z.object({
  id: z.uuid({ error: 'Invalid playlist ID format' }),
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
  description:
    'Creates an empty playlist owned by the caller, private unless asked otherwise. With rules it is smart: it stores no items and computes them on every read.',
  body: z.object({
    title: TitleSchema,
    description: DescriptionSchema.optional(),
    visibility: PlaylistVisibilitySchema.optional(),
    kind: PlaylistKindSchema.optional().describe('playlist unless asked otherwise'),
    rules: PlaylistRulesSchema.optional(),
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
  description: `The playlist, its owner channel and its items in order; a smart one computes them now, in its rules' order, up to its limit. A private playlist of someone else answers 404, as if it did not exist, unless \`${SHARE_TOKEN_PARAM}\` carries a live share link of it; a dead link answers 410.`,
  anonymous: true,
  params: PlaylistIdParamSchema,
  query: ShareQuerySchema,
  status: 200,
  result: PlaylistSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
    410: [ErrorCodes.SHARE_LINK_EXPIRED],
  },
});

export const updatePlaylist = defineEndpoint({
  method: 'PATCH',
  path: '/v1/playlists/:id',
  tag: 'Playlists',
  summary: 'Edit a playlist',
  description:
    'The owner renames, redescribes or changes the visibility and settings of a playlist; an editor retitles and redescribes. Watch Later takes autoRemoveWatched and nothing else.',
  params: PlaylistIdParamSchema,
  body: z.object({
    title: TitleSchema.optional(),
    description: DescriptionSchema.optional(),
    visibility: PlaylistVisibilitySchema.optional(),
    kind: PlaylistKindSchema.optional().describe(
      'Turning a playlist into a series is refused while it holds a video of another channel'
    ),
    rules: PlaylistRulesSchema.optional().describe('A smart playlist only'),
    autoRemoveWatched: z
      .boolean()
      .optional()
      .describe('Refused while the playlist has collaborators, and on a smart one'),
    coverMode: z.enum(PLAYLIST_COVER_MODES).optional(),
    coverVideoId: z
      .uuid()
      .nullable()
      .optional()
      .describe('A video the playlist holds; naming one alone picks the item mode'),
    coverUploadId: z
      .uuid()
      .optional()
      .describe(
        'A cover the owner uploaded whose job is done (`channel.image.ready`); it becomes the custom cover and picks the custom mode'
      ),
  }),
  status: 200,
  result: PlaylistSchema,
  errors: {
    ...WRITE_ERRORS,
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
    409: [
      ErrorCodes.PLAYLIST_IS_SMART,
      ErrorCodes.PLAYLIST_NOT_SMART,
      ErrorCodes.PLAYLIST_HAS_COLLABORATORS,
    ],
    422: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SERIES_VIDEO_NOT_OWNED],
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
  body: z.object({ videoId: z.uuid() }),
  status: 201,
  result: PlaylistSchema,
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.PLAYLIST_IS_SMART],
    422: [ErrorCodes.SERIES_VIDEO_NOT_OWNED],
  },
});

export const removePlaylistItem = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/items/:videoId',
  tag: 'Playlists',
  summary: 'Remove a video from a playlist',
  description:
    'Removes the video; the items after it move up one place. Removing an absent video changes nothing.',
  params: PlaylistIdParamSchema.extend({ videoId: z.uuid() }),
  status: 204,
  result: z.null().describe('Video removed'),
  errors: { ...WRITE_ERRORS, 409: [ErrorCodes.PLAYLIST_IS_SMART] },
});

const MoveSchema = z
  .strictObject({
    itemId: z.uuid(),
    newPosition: z.number().int().nonnegative().describe('Target place; past the end means last'),
  })
  .transform(({ itemId, newPosition }) => ({ type: 'move' as const, itemId, index: newPosition }));

const ReindexSchema = z
  .strictObject({
    itemIds: z
      .array(z.uuid())
      .describe('Every item id the caller sees in the playlist, in the new order'),
  })
  .transform(({ itemIds }) => ({ type: 'reindex' as const, itemIds }));

export const reorderPlaylist = defineEndpoint({
  method: 'PUT',
  path: '/v1/playlists/:id/reorder',
  tag: 'Playlists',
  summary: 'Reorder a playlist',
  description:
    'Moves one item to a new place, or puts the items the caller can see in the order given; a video hidden from them keeps its slot. A full order that misses or repeats a visible item was drawn from a stale view and answers 409.',
  params: PlaylistIdParamSchema,
  body: z.union([MoveSchema, ReindexSchema]),
  status: 200,
  result: PlaylistSchema,
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_ITEM_NOT_FOUND],
    409: [ErrorCodes.VERSION_CONFLICT, ErrorCodes.PLAYLIST_IS_SMART],
  },
});

export const listMyPlaylists = defineEndpoint({
  method: 'GET',
  path: '/v1/me/playlists',
  tag: 'Playlists',
  summary: 'List my playlists',
  description:
    'Every playlist the caller owns, Watch Later first, each flagged with whether it holds videoId: the "Save to playlist" dialog in one round trip.',
  query: z.object({ videoId: z.uuid().optional() }),
  status: 200,
  result: z.object({ items: z.array(OwnedPlaylistSchema) }),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 401: [ErrorCodes.UNAUTHORIZED] },
});
