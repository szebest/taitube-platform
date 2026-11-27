import { PLAYLIST_PIN_LIMIT, SMART_PLAYLIST_MAX_LIMIT } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';
import { PlaylistSchema, PlaylistVisibilitySchema } from './playlist-resource';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const ACTING = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

export const pinPlaylist = defineEndpoint({
  method: 'PUT',
  path: '/v1/playlists/:id/pin',
  tag: 'Playlists',
  summary: 'Pin a playlist',
  description: `The owner shows the playlist as its own shelf in the library, up to ${PLAYLIST_PIN_LIMIT} at a time. Pinning a pinned one changes nothing.`,
  params: PlaylistParamSchema,
  status: 204,
  result: z.null().describe('Playlist pinned'),
  errors: { ...ACTING, 409: [ErrorCodes.PLAYLIST_PIN_LIMIT] },
});

export const unpinPlaylist = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/pin',
  tag: 'Playlists',
  summary: 'Unpin a playlist',
  description:
    'The playlist leaves the shelves of the library. Unpinning one not pinned changes nothing.',
  params: PlaylistParamSchema,
  status: 204,
  result: z.null().describe('Playlist unpinned'),
  errors: ACTING,
});

export const followPlaylist = defineEndpoint({
  method: 'PUT',
  path: '/v1/playlists/:id/follow',
  tag: 'Playlists',
  summary: 'Follow a playlist',
  description:
    "Keeps a live reference to someone else's playlist the caller can read in their library. Following it again changes nothing; the owner cannot follow their own.",
  params: PlaylistParamSchema,
  status: 204,
  result: z.null().describe('Playlist followed'),
  errors: ACTING,
});

export const unfollowPlaylist = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/follow',
  tag: 'Playlists',
  summary: 'Stop following a playlist',
  description:
    'Works whether or not the caller can still read it, so a list gone private can be dropped.',
  params: PlaylistParamSchema,
  status: 204,
  result: z.null().describe('Playlist no longer followed'),
  errors: { 400: [ErrorCodes.VALIDATION_FAILED], 401: [ErrorCodes.UNAUTHORIZED] },
});

const FollowedPlaylistSchema = z.object({
  playlistId: z.uuid(),
  followedAt: z.iso.datetime(),
  playlist: z
    .object({
      title: z.string(),
      visibility: PlaylistVisibilitySchema,
      isSmart: z.boolean(),
      thumbnailUrl: z.string().nullable(),
      videoCount: z.number().int().nonnegative().describe('Videos the caller may watch'),
      owner: ChannelCardSchema.nullable(),
      updatedAt: z.iso.datetime(),
    })
    .nullable()
    .describe('null once the caller can no longer read it: shown as no longer available'),
});

export const listFollowedPlaylists = defineEndpoint({
  method: 'GET',
  path: '/v1/me/playlists/following',
  tag: 'Playlists',
  summary: 'List the playlists I follow',
  description:
    'Newest follow first, keyset-paged. Each one is read as it stands now, so a renamed list shows its new title and one turned private shows as no longer available.',
  query: KeysetQuerySchema,
  status: 200,
  result: z.object({ items: z.array(FollowedPlaylistSchema), nextCursor: z.string().nullable() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const forkPlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/fork',
  tag: 'Playlists',
  summary: 'Fork a playlist',
  description:
    'Copies a playlist the caller can read, items, notes, segments, sections and the rules of a smart one, into a new private playlist of theirs that credits the source. The fork changes on its own from then on.',
  params: PlaylistParamSchema,
  status: 201,
  result: PlaylistSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
  },
});

export const freezePlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/freeze',
  tag: 'Playlists',
  summary: 'Freeze a smart playlist',
  description: `Writes what the smart playlist computes for the caller now, up to ${SMART_PLAYLIST_MAX_LIMIT} videos, as a new normal private playlist of theirs. The smart one stays as it is.`,
  params: PlaylistParamSchema,
  status: 201,
  result: PlaylistSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
    409: [ErrorCodes.PLAYLIST_NOT_SMART],
  },
});

export type FollowedPlaylistView = z.infer<typeof FollowedPlaylistSchema>;
