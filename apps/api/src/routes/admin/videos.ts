import { getVideoAsAdmin, problemFor } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { VideoService } from '../../services/video-service';
import { contractPaths, contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';

export interface AdminVideosRouteOptions {
  videoService: VideoService;
}

/**
 * The operator's read of a video. It calls the same `VideoService.get` as the public route and
 * differs only in what it does with `FORBIDDEN`: the public route disguises it as a 404 so that a
 * private video is indistinguishable from a missing one, and an operator is told the truth.
 *
 * `VideoService` has no branch for either. That is the property ADR-24 exists to provide, and it is
 * asserted in `apps/api/src/routes/admin/__tests__/videos.test.ts`.
 */
export function registerAdminVideosRoutes(
  app: FastifyInstance,
  options: AdminVideosRouteOptions
): void {
  const { videoService } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(getVideoAsAdmin)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getVideoAsAdmin, { hide }),
          params: getVideoAsAdmin.params,
        },
      },
      async (request, reply) =>
        sendResult(
          reply,
          request,
          await videoService.get(request.user ?? null, request.params.id),
          {
            on: {
              FORBIDDEN: (failure) =>
                problemFor(failure, request.url, {
                  title: 'Forbidden',
                  detail: `Video ${failure.videoId} exists but this caller may not read it`,
                }),
            },
          }
        )
    );
  }
}
