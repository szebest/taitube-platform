import { PERSONAL_VOLUME } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { MemberKeySchema } from './watch-party-resource';

const PersonalControlSchema = z
  .object({
    targetKey: MemberKeySchema,
    roomId: z.uuid().nullable().describe('null: every room the viewer shares with the target'),
    voiceMuted: z.boolean(),
    volume: z.number().int().min(PERSONAL_VOLUME.min).max(PERSONAL_VOLUME.max),
    hideMessages: z.boolean(),
    hideReactions: z.boolean(),
    hideAvatar: z.boolean(),
    hideRequests: z.boolean(),
    blockInvites: z.boolean().describe('Everywhere scope only'),
    favourite: z.boolean(),
  })
  .meta({
    id: 'WatchPartyPersonalControl',
    description: 'What the viewer chose about one member, for themselves only',
  });

export const listWatchPartyControls = defineEndpoint({
  method: 'GET',
  path: '/v1/me/watch-party-controls',
  tag: 'Watch parties',
  summary: 'My personal controls',
  description: 'Every everywhere control, and with roomId the ones for that room too.',
  query: z.object({ roomId: z.uuid().optional() }).optional(),
  status: 200,
  result: z.object({ items: z.array(PersonalControlSchema) }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
  },
});

export const putWatchPartyControl = defineEndpoint({
  method: 'PUT',
  path: '/v1/me/watch-party-controls',
  tag: 'Watch parties',
  summary: 'Set a personal control',
  description:
    'Sets what the viewer chose about one member; choosing nothing deletes the row. Other signed-in devices get party.controls.updated.',
  body: PersonalControlSchema.partial()
    .required({ targetKey: true, roomId: true })
    .refine(({ roomId, blockInvites }) => roomId === null || blockInvites !== true, {
      error: 'blockInvites is an everywhere control',
      path: ['blockInvites'],
    }),
  status: 200,
  result: z.object({ items: z.array(PersonalControlSchema) }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type PersonalControlView = z.infer<typeof PersonalControlSchema>;
