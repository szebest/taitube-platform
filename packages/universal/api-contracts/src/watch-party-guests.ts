import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { MembershipSchema, WatchPartyIdParamSchema } from './watch-party-resource';

/** The cookie the web keeps the party credential in; the app's `/api` proxy forwards it as the header. */
export const PARTY_GUEST_COOKIE = 'vp.party-guest';
export const PARTY_CREDENTIAL_HEADER = 'x-party-credential';

export const joinWatchPartyAsGuest = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/guest',
  tag: 'Watch parties',
  summary: 'Watch as a guest',
  description:
    'Issues a guest party credential, set as the httpOnly vp.party-guest cookie, and its seat in one step, where the room allows guests. The nickname is generated. 5 credentials per IP an hour, 30 guest joins per room a minute.',
  anonymous: true,
  params: WatchPartyIdParamSchema,
  body: z.object({ invite: z.string().max(128).optional() }).nullish(),
  status: 201,
  result: z.object({
    membership: MembershipSchema,
    expiresAt: z.iso.datetime().describe('Slides forward 12 h on each use'),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    403: [
      ErrorCodes.WATCH_PARTY_GUESTS_OFF,
      ErrorCodes.WATCH_PARTY_BANNED,
      ErrorCodes.WATCH_PARTY_INVITE_INVALID,
    ],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_FULL],
    410: [ErrorCodes.WATCH_PARTY_CLOSED],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export const upgradeWatchPartySeat = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/seat/upgrade',
  tag: 'Watch parties',
  summary: 'Upgrade a guest seat',
  description:
    "Moves the guest's seat to the signed-in account (or a Discord party credential) in place: the socket stays open and gets you.",
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  status: 200,
  result: z.object({ membership: MembershipSchema }),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED, ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID],
    403: [ErrorCodes.WATCH_PARTY_BANNED],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  },
});
