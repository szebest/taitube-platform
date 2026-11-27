import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { MemberKeySchema, WatchPartyIdParamSchema } from './watch-party-resource';

const MemberParamsSchema = WatchPartyIdParamSchema.extend({ memberKey: MemberKeySchema });

const MODERATION_REFUSALS = [
  ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
  ErrorCodes.WATCH_PARTY_ROLE_ESCALATION,
] as const;

export const kickWatchPartyMember = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/members/:memberKey/kick',
  tag: 'Watch parties',
  summary: 'Kick a member',
  description:
    'Removes a member below you (members.kick); they may rejoin. Their socket gets kicked.',
  params: MemberParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: MODERATION_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const removeWatchPartyGuests = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/guests/remove',
  tag: 'Watch parties',
  summary: 'Remove all guests',
  description: 'Every guest seat goes (members.kick); each guest socket gets kicked.',
  params: WatchPartyIdParamSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const banWatchPartyMember = defineEndpoint({
  method: 'PUT',
  path: '/v1/watch-parties/:id/bans/:memberKey',
  tag: 'Watch parties',
  summary: 'Ban a member',
  description:
    "Bans a member below you for the room's life (members.ban); a guest ban also keeps the guest's IP hash.",
  params: MemberParamsSchema,
  body: z.object({ reason: z.string().max(200).optional() }).optional(),
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: MODERATION_REFUSALS,
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const unbanWatchPartyMember = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/bans/:memberKey',
  tag: 'Watch parties',
  summary: 'Lift a ban',
  description: 'Lets a banned member join again (members.ban).',
  params: MemberParamsSchema,
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});

export const transferWatchPartyOwnership = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/owner',
  tag: 'Watch parties',
  summary: 'Transfer ownership',
  description: 'The owner hands the room to a non-guest member and holds Co-host from then on.',
  params: WatchPartyIdParamSchema,
  body: z.object({ memberKey: MemberKeySchema }),
  status: 200,
  result: z.object({ ownerKey: MemberKeySchema, rolesVersion: z.number().int() }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_ROLE_ESCALATION],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});
