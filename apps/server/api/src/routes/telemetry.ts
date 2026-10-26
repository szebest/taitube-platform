import { recordPlayback, recordWebVitals } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  const { webVitalsService, playbackTelemetryService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  // navigator.sendBeacon posts text/plain to stay a simple request with no CORS preflight.
  app.removeContentTypeParser('text/plain');
  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    app.getDefaultJsonParser('error', 'error')
  );

  server.post(
    recordWebVitals.path,
    {
      bodyLimit: app.config.webVitals.bodyLimitBytes,
      config: { rateLimit: { max: app.config.webVitals.ratePerMinute, timeWindow: '1 minute' } },
      schema: {
        ...contractSchema(recordWebVitals),
        body: recordWebVitals.body,
      },
    },
    async (request, reply) =>
      sendResult(reply, request, webVitalsService.record(request.body), {
        status: recordWebVitals.status,
      })
  );

  server.post(
    recordPlayback.path,
    {
      bodyLimit: app.config.playbackTelemetry.bodyLimitBytes,
      config: {
        rateLimit: { max: app.config.playbackTelemetry.ratePerMinute, timeWindow: '1 minute' },
      },
      schema: {
        ...contractSchema(recordPlayback),
        body: recordPlayback.body,
      },
    },
    async (request, reply) =>
      sendResult(reply, request, await playbackTelemetryService.record(request.body), {
        status: recordPlayback.status,
      })
  );
}
