import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { MemberKeySchema, WatchPartyIdParamSchema } from './watch-party-resource';

const VoiceTokenSchema = z
  .object({
    url: z.string().describe('The WebSocket URL to connect to'),
    token: z.string(),
    expiresAt: z.iso.datetime().describe('When the token stops admitting a join'),
    canSpeak: z.boolean().describe('false: a listener, whatever the roles say'),
  })
  .meta({ id: 'WatchPartyVoiceToken', description: 'What a client needs to join the room voice' });

export const createWatchPartyVoiceToken = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/voice/token',
  tag: 'Watch parties',
  summary: 'Voice token',
  description:
    'Mints a ten-minute join token whose grants follow the caller roles: voice.join to listen, voice.speak to publish audio, a guest never publishes. With the speaker list full, a caller who could speak gets 409 and asks again with listenOnly.',
  partyGuest: true,
  params: WatchPartyIdParamSchema,
  body: z.object({ listenOnly: z.boolean().optional() }).optional(),
  status: 201,
  result: VoiceTokenSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    409: [ErrorCodes.WATCH_PARTY_VOICE_SPEAKERS_FULL, ErrorCodes.WATCH_PARTY_CLOSED],
    503: [ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE],
  },
});

export const removeWatchPartyVoiceMember = defineEndpoint({
  method: 'POST',
  path: '/v1/watch-parties/:id/voice/members/:memberKey/remove',
  tag: 'Watch parties',
  summary: 'Remove from voice',
  description:
    'Disconnects a member below you from voice only (voice.moderate); they stay in the room and may join voice again.',
  params: WatchPartyIdParamSchema.extend({ memberKey: MemberKeySchema }),
  status: 204,
  result: z.null(),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.WATCH_PARTY_PERMISSION_MISSING, ErrorCodes.WATCH_PARTY_ROLE_ESCALATION],
    404: [ErrorCodes.WATCH_PARTY_NOT_FOUND],
    503: [ErrorCodes.WATCH_PARTY_VOICE_UNAVAILABLE],
  },
});

/** The media server's own signed call on the compose network: the body stays a string so the signature can be checked against it. */
export const receiveVoiceWebhook = defineEndpoint({
  method: 'POST',
  path: '/v1/internal/voice/webhook',
  tag: 'Internal',
  summary: 'Receive a voice webhook',
  description:
    'LiveKit reports a participant joining or leaving; its signature rides in the Authorization header.',
  anonymous: true,
  internal: true,
  body: z.string(),
  status: 204,
  result: z.null().describe('Taken'),
  errors: { 401: [ErrorCodes.UNAUTHORIZED] },
});
