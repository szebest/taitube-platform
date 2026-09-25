import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { CategorySchema } from './categories';
import { ChannelSchema } from './channels';
import { defineEndpoint } from './endpoint';

const BootstrapSchema = z.object({
  user: ChannelSchema.nullable().describe('The caller channel, or null for a guest'),
  categories: z.array(CategorySchema).describe('Active categories in display order'),
  featureFlags: z
    .record(z.string(), z.boolean())
    .describe('Enabled flags; a flag that is absent is off'),
});

export const getBootstrap = defineEndpoint({
  method: 'GET',
  path: '/v1/bootstrap',
  tag: 'Bootstrap',
  summary: 'Initial app context in one round trip',
  description:
    'The caller channel (null for a guest), the active categories and the enabled feature flags. Public; a valid bearer token adds the channel, an invalid one is refused.',
  anonymous: true,
  status: 200,
  result: BootstrapSchema,
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
  },
});

export type Bootstrap = z.infer<typeof BootstrapSchema>;
