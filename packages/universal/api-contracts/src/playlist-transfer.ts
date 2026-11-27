import {
  PLAYLIST_IMPORT_MAX_BYTES,
  PLAYLIST_IMPORT_MAX_LINES,
  PLAYLIST_MERGE_MAX_SOURCES,
  PLAYLIST_TRANSFER_MAX_ITEMS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const ItemResultSchema = z.object({
  itemId: z.uuid().describe('The item as the request named it'),
  ok: z.boolean().describe('false for a refused item'),
  duplicate: z
    .boolean()
    .describe('The target held its video already, so it was skipped; ok stays true'),
  code: z
    .enum([ErrorCodes.FORBIDDEN, ErrorCodes.PLAYLIST_ITEM_NOT_FOUND, ErrorCodes.VIDEO_NOT_FOUND])
    .optional()
    .describe(
      'Why a refused item did not land: not allowed, gone from the source, or its video gone'
    ),
});

const BatchResultSchema = z.object({
  playlistId: z.uuid().describe('The playlist the items went into'),
  results: z.array(ItemResultSchema),
});

const ACTING = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

export const transferPlaylistItems = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/items/transfer',
  tag: 'Playlists',
  summary: 'Move or copy items to another playlist',
  description:
    'Each item is checked on its own: a move removes it from this playlist, which a contributor may do only with their own; the target needs the right to add. One refusal never fails the batch.',
  params: PlaylistParamSchema,
  body: z.object({
    itemIds: z.array(z.uuid()).min(1).max(PLAYLIST_TRANSFER_MAX_ITEMS),
    to: z.uuid().describe('The target playlist'),
    mode: z.enum(['move', 'copy']),
  }),
  status: 200,
  result: BatchResultSchema,
  errors: { ...ACTING, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const duplicatePlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/duplicate',
  tag: 'Playlists',
  summary: 'Duplicate a playlist',
  description:
    'Copies a playlist the caller can read, items, notes, segments and sections, into a new private playlist of theirs.',
  params: PlaylistParamSchema,
  body: z.object({
    title: z.string().optional().describe('Defaults to the title of the source'),
  }),
  status: 201,
  result: BatchResultSchema,
  errors: { ...ACTING, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const mergePlaylists = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/merge',
  tag: 'Playlists',
  summary: 'Merge playlists',
  description:
    'Copies the items of the sources, in order, into one playlist the caller may add to, or into a new one of theirs; videos held already are skipped. deleteSources deletes each source the caller owns once its items are in.',
  body: z
    .object({
      sourceIds: z.array(z.uuid()).min(1).max(PLAYLIST_MERGE_MAX_SOURCES),
      into: z.uuid().optional(),
      newTitle: z.string().optional(),
      deleteSources: z.boolean().default(false),
    })
    .refine((body) => (body.into === undefined) !== (body.newTitle === undefined), {
      error: 'Name either into or newTitle',
    }),
  status: 200,
  result: BatchResultSchema,
  errors: {
    ...ACTING,
    400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

const FormatSchema = z.enum(['json', 'csv']);

export const exportPlaylist = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/export',
  tag: 'Playlists',
  summary: 'Export a playlist',
  description:
    'The videos this viewer may watch, each with its id, watch URL, title, channel, note and segment, as a document that import takes back unchanged.',
  anonymous: true,
  params: PlaylistParamSchema,
  query: z.object({ format: FormatSchema.default('json') }),
  status: 200,
  result: z.object({
    format: FormatSchema,
    filename: z.string(),
    content: z.string().describe('The JSON or CSV document'),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.PLAYLIST_NOT_FOUND],
  },
});

export const importPlaylist = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/import',
  tag: 'Playlists',
  summary: 'Import videos into a playlist',
  description: `Up to ${PLAYLIST_IMPORT_MAX_LINES} lines and ${PLAYLIST_IMPORT_MAX_BYTES} bytes: a JSON or CSV export, or one video id or watch URL of this site per line. A URL of another site is reported unrecognised and never fetched.`,
  params: PlaylistParamSchema,
  body: z.object({
    format: z.enum(['json', 'csv', 'urls']),
    content: z.string().max(PLAYLIST_IMPORT_MAX_BYTES),
  }),
  status: 200,
  result: z.object({
    lines: z.array(
      z.object({
        line: z.number().int().positive().describe('1-based, counting the entries of the document'),
        status: z.enum(['added', 'duplicate', 'not_found', 'unrecognised']),
        videoId: z.uuid().nullable(),
      })
    ),
  }),
  errors: { ...ACTING, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export type PlaylistImportLineView = z.infer<typeof importPlaylist.result>['lines'][number];
export type PlaylistItemResultView = z.infer<typeof ItemResultSchema>;
