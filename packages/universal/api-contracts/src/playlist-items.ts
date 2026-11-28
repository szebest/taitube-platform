import { PLAYLIST_ITEM_SORTS, PLAYLIST_SEGMENT_MIN_MS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { PlaylistItemSchema, ShareQuerySchema } from './playlist-resource';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const ItemParamSchema = PlaylistParamSchema.extend({
  itemId: z.uuid({ error: 'Invalid item ID format' }),
});

const SortSchema = z
  .enum(PLAYLIST_ITEM_SORTS)
  .describe(
    'manual: the playlist order; added: newest first; duration: shortest first; channel: by channel name; unwatched_first: what this viewer has not finished first'
  );

const WRITE_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
  409: [ErrorCodes.PLAYLIST_IS_SMART],
} as const;

export const listPlaylistItems = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/items',
  tag: 'Playlists',
  summary: 'Page through the items of a playlist',
  description:
    'The videos of a playlist this viewer may watch, in the order asked for, keyset-paged on it. Sections are left out; they come with the playlist. A smart playlist pages what its rules compute, in their order and up to their limit, whatever the sort.',
  anonymous: true,
  params: PlaylistParamSchema,
  query: KeysetQuerySchema.extend({ sort: SortSchema.default('manual') }).extend(
    ShareQuerySchema.shape
  ),
  status: 200,
  result: z.object({ items: z.array(PlaylistItemSchema), nextCursor: z.string().nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
    410: [ErrorCodes.SHARE_LINK_EXPIRED],
  },
});

const MsSchema = z.number().int().nonnegative();

export const editPlaylistItem = defineEndpoint({
  method: 'PATCH',
  path: '/v1/playlists/:id/items/:itemId/annotation',
  tag: 'Playlists',
  summary: 'Annotate an item',
  description: `A video item takes a note and a segment, a section its title. A segment lasts at least ${PLAYLIST_SEGMENT_MIN_MS} ms and falls inside the video; null clears a field. An editor edits any item, a contributor only their own.`,
  params: ItemParamSchema,
  body: z
    .strictObject({
      note: z.string().nullable().optional().describe('Up to 300 characters'),
      startMs: MsSchema.nullable().optional(),
      endMs: MsSchema.nullable().optional(),
      title: z.string().optional().describe('A section only: 1-80 characters'),
    })
    .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
      error: 'Name at least one field to change',
    }),
  status: 204,
  result: z.null().describe('Item changed'),
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_ITEM_NOT_FOUND],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const addPlaylistSection = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/sections',
  tag: 'Playlists',
  summary: 'Add a section',
  description:
    'Appends a divider with a title. It holds no video, is never counted and moves like an item.',
  params: PlaylistParamSchema,
  body: z.object({ title: z.string().describe('1-80 characters of plain text after trimming') }),
  status: 201,
  result: z.object({ id: z.uuid().describe('The item id a reorder or an edit names') }),
  errors: { ...WRITE_ERRORS, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const removePlaylistSection = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/sections/:itemId',
  tag: 'Playlists',
  summary: 'Remove a section',
  description: 'Removes a divider; the items under it stay where they are.',
  params: ItemParamSchema,
  status: 204,
  result: z.null().describe('Section removed'),
  errors: {
    ...WRITE_ERRORS,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_ITEM_NOT_FOUND],
  },
});

export const sortPlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/sort',
  tag: 'Playlists',
  summary: 'Sort a playlist for good',
  description:
    'The owner or an editor writes a sort back as the playlist order, over every video whoever may watch it; sections follow the videos.',
  params: PlaylistParamSchema,
  body: z.object({ sort: SortSchema.exclude(['manual']) }),
  status: 204,
  result: z.null().describe('Playlist sorted'),
  errors: WRITE_ERRORS,
});
