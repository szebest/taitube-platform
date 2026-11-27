import {
  MAX_ACTIVE_SHARE_LINKS,
  PLAYLIST_STATS_RANGES,
  PLAYLIST_TOP_ITEMS,
  SHARE_LINK_EXPIRIES,
  SHARE_LINK_LABEL_MAX_LENGTH,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { SHARE_TOKEN_PARAM, ShareLinkSchema } from './video-access';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const OWNER_ONLY = {
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

export const listPlaylistShareLinks = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/share-links',
  tag: 'Playlists',
  summary: 'List the share links of a playlist',
  description:
    'The owner sees every link, newest first, the expired and revoked ones included, each with its opens.',
  params: PlaylistParamSchema,
  status: 200,
  result: z.object({ items: z.array(ShareLinkSchema) }),
  errors: OWNER_ONLY,
});

export const createPlaylistShareLink = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/share-links',
  tag: 'Playlists',
  summary: 'Create a share link for a playlist',
  description: `A link opens /playlist/:id?${SHARE_TOKEN_PARAM}=token and lets its holder read the playlist whatever its visibility until it expires or is revoked, with the expiry presets of a video link. It grants nothing else: each video still needs its own right to be watched. At most ${MAX_ACTIVE_SHARE_LINKS} active links; Watch Later is never shared.`,
  params: PlaylistParamSchema,
  body: z.object({
    label: z.string().optional().describe(`Up to ${SHARE_LINK_LABEL_MAX_LENGTH} characters`),
    expiresIn: z.enum(SHARE_LINK_EXPIRIES).describe('How long the link works'),
  }),
  status: 201,
  result: ShareLinkSchema,
  errors: {
    ...OWNER_ONLY,
    409: [ErrorCodes.SHARE_LINK_LIMIT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const revokePlaylistShareLink = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/share-links/:linkId',
  tag: 'Playlists',
  summary: 'Revoke a share link of a playlist',
  description: 'The link answers 410 SHARE_LINK_EXPIRED from the next request on.',
  params: PlaylistParamSchema.extend({ linkId: z.uuid() }),
  status: 204,
  result: z.null(),
  errors: { ...OWNER_ONLY, 404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.SHARE_LINK_NOT_FOUND] },
});

const CountSchema = z.number().int().nonnegative();

export const getPlaylistStats = defineEndpoint({
  method: 'GET',
  path: '/v1/me/playlists/:id/stats',
  tag: 'Playlists',
  summary: 'Read the stats of my playlist',
  description: `The owner's alone: page opens, plays started from the playlist, follows and forks over the range, and the ${PLAYLIST_TOP_ITEMS} most played videos. Counted through the view buffer, so the last minutes show after the next flush.`,
  params: PlaylistParamSchema,
  query: z.object({ range: z.enum(PLAYLIST_STATS_RANGES).default('30d') }),
  status: 200,
  result: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    opens: CountSchema,
    plays: CountSchema,
    follows: CountSchema,
    forks: CountSchema,
    topItems: z
      .array(z.object({ videoId: z.uuid(), title: z.string(), plays: CountSchema }))
      .max(PLAYLIST_TOP_ITEMS)
      .describe('Most plays first; a video no longer in the playlist still counts'),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
  },
});

export type PlaylistStatsView = z.infer<typeof getPlaylistStats.result>;
