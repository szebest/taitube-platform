import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

/** What MediaMTX posts to its HTTP auth hook; every field is a string, empty when it does not apply. */
const GatewayCallSchema = z.object({
  user: z.string().default(''),
  password: z.string().default(''),
  action: z.string(),
  path: z.string().default(''),
  protocol: z.string().default(''),
  id: z.string().nullable().optional(),
  ip: z.string().optional(),
  query: z.string().optional(),
});

/**
 * The ingest gateway's auth hook, called by MediaMTX alone on the compose network: the shared secret
 * rides in the query string because MediaMTX sends no header of its own.
 */
export const authorizeLiveIngest = defineEndpoint({
  method: 'POST',
  path: '/v1/internal/live/auth',
  tag: 'Internal',
  summary: 'Authorize an ingest call',
  description:
    'MediaMTX asks before a publisher or reader is let in. A publisher on an idle stream key takes the stream live.',
  anonymous: true,
  internal: true,
  query: z.object({ secret: z.string().optional() }),
  body: GatewayCallSchema,
  status: 204,
  result: z.null().describe('Admitted'),
  errors: { 401: [ErrorCodes.LIVE_INGEST_REFUSED] },
});
