import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { WatchPartyIdParamSchema } from './watch-party-resource';

const INTEREST_ERRORS = {
  401: [ErrorCodes.UNAUTHORIZED],
  404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
  410: [ErrorCodes.WATCH_PARTY_CLOSED],
  422: [ErrorCodes.VALIDATION_FAILED],
} as const;

export const markWatchPartyInterest = defineEndpoint({
  method: 'PUT',
  path: '/v1/watch-parties/:id/interest',
  tag: 'Watch parties',
  summary: 'Mark interest in a scheduled party',
  description:
    'Interested accounts get party_starting 10 minutes before the party and when it starts. Idempotent; only a scheduled room can be marked.',
  params: WatchPartyIdParamSchema,
  status: 204,
  result: z.null(),
  errors: INTEREST_ERRORS,
});

export const clearWatchPartyInterest = defineEndpoint({
  method: 'DELETE',
  path: '/v1/watch-parties/:id/interest',
  tag: 'Watch parties',
  summary: 'Withdraw interest in a scheduled party',
  description: 'Idempotent.',
  params: WatchPartyIdParamSchema,
  status: 204,
  result: z.null(),
  errors: { 401: [ErrorCodes.UNAUTHORIZED], 404: [ErrorCodes.WATCH_PARTY_NOT_FOUND] },
});
