import { MS_PER_MINUTE } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

const TELEMETRY_APPS = ['web', 'studio'] as const;

const WEB_VITAL_NAMES = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;

/** Five vitals per page, each reported again after a back-forward cache restore, with room to spare. */
export const MAX_WEB_VITALS_PER_BATCH = 32;

const MAX_ROUTE_ID_LENGTH = 128;

/** A TanStack Router route id: a path pattern such as `/watch/$videoId`, or `__root__`. */
const RouteIdSchema = z
  .string()
  .min(1)
  .max(MAX_ROUTE_ID_LENGTH)
  .regex(/^[\w$./(){}-]+$/)
  .describe('Route id of the page the browser measured, never its URL');

const WebVitalSchema = z.object({
  name: z.enum(WEB_VITAL_NAMES),
  value: z
    .number()
    .nonnegative()
    .max(10 * MS_PER_MINUTE)
    .describe(
      'What the browser reported: milliseconds, or the unitless layout shift score for CLS'
    ),
  route: RouteIdSchema,
});

const WebVitalsBatchSchema = z.object({
  app: z.enum(TELEMETRY_APPS).describe('The client app that measured the batch'),
  vitals: z.array(WebVitalSchema).min(1).max(MAX_WEB_VITALS_PER_BATCH),
});

export const recordWebVitals = defineEndpoint({
  method: 'POST',
  path: '/v1/telemetry/vitals',
  tag: 'Telemetry',
  summary: 'Record a batch of Core Web Vitals',
  description:
    'Real-user LCP, INP, CLS, FCP and TTFB from the client apps, recorded as Prometheus histograms by app and route id. Also accepted as text/plain, which is what navigator.sendBeacon sends without a CORS preflight. A body over the limit is refused with 413.',
  anonymous: true,
  body: WebVitalsBatchSchema,
  status: 204,
  result: z.null().describe('Batch recorded'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    413: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type TelemetryApp = (typeof TELEMETRY_APPS)[number];
export type WebVital = z.infer<typeof WebVitalSchema>;
export type WebVitalsBatch = z.infer<typeof WebVitalsBatchSchema>;
