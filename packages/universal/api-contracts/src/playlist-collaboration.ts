import {
  MAX_PLAYLIST_COLLABORATORS,
  PLAYLIST_COLLABORATOR_ROLES,
  PLAYLIST_INVITE_DEFAULT_DAYS,
  PLAYLIST_INVITE_MAX_DAYS,
  PLAYLIST_INVITE_MAX_USES,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { ChannelCardSchema } from './channels';
import { defineEndpoint } from './endpoint';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const RoleSchema = z
  .enum(PLAYLIST_COLLABORATOR_ROLES)
  .describe(
    'editor: adds, removes, reorders, annotates and retitles; contributor: adds, and removes or annotates only what they added'
  );

const CollaboratorSchema = z.object({
  userId: z.uuid(),
  role: RoleSchema,
  channel: ChannelCardSchema.nullable().describe("The collaborator's primary channel"),
  joinedAt: z.iso.datetime(),
});

const InviteSchema = z.object({
  id: z.uuid(),
  role: RoleSchema,
  token: z.string().describe('What POST /v1/playlist-invites/:token/accept takes'),
  invitee: ChannelCardSchema.nullable().describe('The person invited; null on a link invite'),
  state: z.enum(['active', 'expired', 'revoked', 'exhausted']),
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int().positive().nullable().describe('null admits anyone until it expires'),
  useCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

const CollaboratorsSchema = z.object({
  items: z.array(CollaboratorSchema).describe(`Oldest first, up to ${MAX_PLAYLIST_COLLABORATORS}`),
});

const TokenParamSchema = z.object({ token: z.string().min(1).max(64) });

const ACTING = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND],
} as const;

const SEATS_FULL = { 409: [ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT] } as const;

const SEATING = {
  ...ACTING,
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
} as const;

export const listPlaylistCollaborators = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/collaborators',
  tag: 'Playlists',
  summary: 'List the collaborators of a playlist',
  description: 'The people working on the playlist with its owner, for the owner and for them.',
  params: PlaylistParamSchema,
  status: 200,
  result: CollaboratorsSchema,
  errors: ACTING,
});

export const invitePlaylistCollaborator = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/collaborators',
  tag: 'Playlists',
  summary: 'Invite someone to a playlist',
  description: `The owner invites the person behind a channel handle with a role. They are notified and join when they accept, within ${PLAYLIST_INVITE_DEFAULT_DAYS} days; a new invite replaces an earlier one to them.`,
  params: PlaylistParamSchema,
  body: z.object({
    handle: z.string().min(1).describe('The handle of their channel, without @'),
    role: RoleSchema,
  }),
  status: 201,
  result: InviteSchema,
  errors: {
    ...SEATING,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.CHANNEL_NOT_FOUND],
    409: [ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS, ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT],
  },
});

const UserParamSchema = PlaylistParamSchema.extend({
  userId: z.uuid({ error: 'Invalid user ID format' }),
});

export const changePlaylistCollaboratorRole = defineEndpoint({
  method: 'PATCH',
  path: '/v1/playlists/:id/collaborators/:userId',
  tag: 'Playlists',
  summary: 'Change the role of a collaborator',
  description: 'The owner makes a collaborator an editor or a contributor.',
  params: UserParamSchema,
  body: z.object({ role: RoleSchema }),
  status: 204,
  result: z.null().describe('Role changed'),
  errors: {
    ...ACTING,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND],
  },
});

export const removePlaylistCollaborator = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/collaborators/:userId',
  tag: 'Playlists',
  summary: 'Remove a collaborator',
  description: 'The owner takes a collaborator off the playlist; what they added stays.',
  params: UserParamSchema,
  status: 204,
  result: z.null().describe('Collaborator removed'),
  errors: {
    ...ACTING,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND],
  },
});

export const leavePlaylist = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/collaborators/me',
  tag: 'Playlists',
  summary: 'Leave a playlist',
  description: 'A collaborator gives up their seat; the owner cannot leave their own playlist.',
  params: PlaylistParamSchema,
  status: 204,
  result: z.null().describe('Left the playlist'),
  errors: {
    ...ACTING,
    404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND],
  },
});

export const createPlaylistInviteLink = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/invites',
  tag: 'Playlists',
  summary: 'Create an invite link',
  description:
    'The owner makes a link anyone signed in can join with, in the role given, until it expires, is revoked or is used up.',
  params: PlaylistParamSchema,
  body: z.object({
    role: RoleSchema,
    expiresInDays: z
      .number()
      .int()
      .min(1)
      .max(PLAYLIST_INVITE_MAX_DAYS)
      .optional()
      .describe(`Defaults to ${PLAYLIST_INVITE_DEFAULT_DAYS}`),
    maxUses: z
      .number()
      .int()
      .min(1)
      .max(PLAYLIST_INVITE_MAX_USES)
      .nullable()
      .describe('null admits anyone until it expires'),
  }),
  status: 201,
  result: InviteSchema,
  errors: { ...SEATING, ...SEATS_FULL },
});

export const listPlaylistInvites = defineEndpoint({
  method: 'GET',
  path: '/v1/playlists/:id/invites',
  tag: 'Playlists',
  summary: 'List the invites of a playlist',
  description: 'Personal invites and links, newest first, revoked ones left out; the owner only.',
  params: PlaylistParamSchema,
  status: 200,
  result: z.object({ items: z.array(InviteSchema) }),
  errors: ACTING,
});

export const revokePlaylistInvite = defineEndpoint({
  method: 'DELETE',
  path: '/v1/playlists/:id/invites/:inviteId',
  tag: 'Playlists',
  summary: 'Revoke an invite',
  description: 'The owner ends an invite or a link; revoking one that is gone changes nothing.',
  params: PlaylistParamSchema.extend({ inviteId: z.uuid({ error: 'Invalid invite ID format' }) }),
  status: 204,
  result: z.null().describe('Invite revoked'),
  errors: ACTING,
});

const INVITE_TAKEN = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  410: [ErrorCodes.PLAYLIST_INVITE_INVALID],
} as const;

export const acceptPlaylistInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/playlist-invites/:token/accept',
  tag: 'Playlists',
  summary: 'Accept a playlist invite',
  description:
    "Joins the playlist in the role of the invite. An unknown, expired, revoked, used up or someone else's invite answers 410 alike.",
  params: TokenParamSchema,
  status: 200,
  result: z.object({ playlistId: z.uuid(), role: RoleSchema }),
  errors: {
    ...INVITE_TAKEN,
    409: [ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS, ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT],
  },
});

export const declinePlaylistInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/playlist-invites/:token/decline',
  tag: 'Playlists',
  summary: 'Decline a playlist invite',
  description: 'The invitee turns a personal invite down; a link invite cannot be declined.',
  params: TokenParamSchema,
  status: 204,
  result: z.null().describe('Invite declined'),
  errors: INVITE_TAKEN,
});

export type PlaylistCollaboratorView = z.infer<typeof CollaboratorSchema>;
export type PlaylistInviteView = z.infer<typeof InviteSchema>;
