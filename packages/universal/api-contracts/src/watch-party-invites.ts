import { WATCH_PARTY_INVITE_LINK_TTLS, WATCH_PARTY_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { WatchPartyIdParamSchema } from './watch-party-resource';

const InviteParamsSchema = WatchPartyIdParamSchema.extend({
  inviteId: z.uuid({ error: 'Invalid invite ID format' }),
});

const LinkParamsSchema = WatchPartyIdParamSchema.extend({
  linkId: z.uuid({ error: 'Invalid invite link ID format' }),
});

const InviteSchema = z.object({
  id: z.uuid(),
  inviteeId: z.uuid(),
  inviterId: z.uuid(),
  status: z.enum(['pending', 'joined']).describe('A decline stays pending until it expires'),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

const InviteLinkSchema = z.object({
  id: z.uuid(),
  createdBy: z.string(),
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int().positive().nullable(),
  uses: z.number().int().nonnegative(),
  revoked: z.boolean(),
  createdAt: z.iso.datetime(),
});

const INVITER_REFUSALS = [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING] as const;

export const inviteToWatchParty = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/invites',
  tag: 'Watch parties',
  summary: 'Invite people',
  description:
    'Sends a party_invite to each account (members.invite). A second invite inside the group window folds; an invitee whose settings refuse it is listed in refused, without a reason.',
  params: WatchPartyIdParamSchema,
  body: z.object({
    userIds: z.array(z.uuid()).min(1).max(WATCH_PARTY_LIMITS.invitesPerRequest),
  }),
  status: 201,
  result: z.object({
    sent: z.array(z.object({ userId: z.uuid(), inviteId: z.uuid() })),
    folded: z.array(z.object({ userId: z.uuid() })),
    refused: z.array(z.object({ userId: z.uuid() })),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export const listWatchPartyInvites = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/invites',
  tag: 'Watch parties',
  summary: 'List invites',
  description: 'Pending and joined invites (members.invite).',
  params: WatchPartyIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(InviteSchema) }),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const revokeWatchPartyInvite = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/invites/:inviteId',
  tag: 'Watch parties',
  summary: 'Revoke an invite',
  description: 'Stops an invite from admitting anyone (members.invite).',
  params: InviteParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const declineWatchPartyInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/me/watch-party-invites/:inviteId/decline',
  tag: 'Watch parties',
  summary: 'Decline an invite',
  description: 'The invitee declines and its notification is marked read. Nobody is told.',
  params: z.object({ inviteId: z.uuid({ error: 'Invalid invite ID format' }) }),
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.WATCH_PARTY_INVITE_INVALID],
  },
});

export const createWatchPartyInviteLink = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/invite-links',
  tag: 'Watch parties',
  summary: 'Create an invite link',
  description:
    'A bearer link that skips the password, never the capacity (members.invite). The token is shown once.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  body: z.object({
    ttl: z.enum(WATCH_PARTY_INVITE_LINK_TTLS).default('24h'),
    maxUses: z.number().int().min(1).max(1000).optional(),
  }),
  status: 201,
  result: z.object({
    id: z.uuid(),
    token: z.string(),
    url: z.string().describe('/parties/<id>?invite=<token>'),
    expiresAt: z.iso.datetime(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
  },
});

export const listWatchPartyInviteLinks = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/invite-links',
  tag: 'Watch parties',
  summary: 'List invite links',
  description: 'Every link of the room, without its token (members.invite).',
  params: WatchPartyIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(InviteLinkSchema) }),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const revokeWatchPartyInviteLink = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/invite-links/:linkId',
  tag: 'Watch parties',
  summary: 'Revoke an invite link',
  description:
    'Stops new joins through the link; nobody who joined by it is removed (members.invite).',
  params: LinkParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const listWatchPartyInviteCandidates = defineEndpoint({
  method: 'GET',
  path: '/v1/watch-parties/:id/invite-candidates',
  tag: 'Watch parties',
  summary: 'People to invite',
  description:
    'Recent co-watchers, owners of channels the caller subscribes to, and a handle or name prefix match (members.invite).',
  params: WatchPartyIdParamSchema,
  query: z.object({ q: z.string().max(100).optional() }).optional(),
  status: 200,
  result: z.object({
    items: z.array(
      z.object({
        userId: z.uuid(),
        handle: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        reason: z.enum(['co_watcher', 'subscription', 'match']),
        inRoom: z.boolean(),
        invited: z.boolean(),
      })
    ),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: INVITER_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});
