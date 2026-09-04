import type { JobQueue, VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { VideoService } from '../services/video-service.js';

export interface VideosRouteOptions {
  videos?: VideoRepository;
  cdnBaseUrl?: string;
  videoService?: VideoService;
  probeQueue?: JobQueue;
}

/**
 * Fastify routes plugin for video queries and management (SDD §6.1, §6.3).
 * Thin transport adapter delegating domain operations to VideoService.
 */
export function registerVideosRoutes(app: FastifyInstance, options: VideosRouteOptions): void {
  const {
    videos,
    cdnBaseUrl = process.env['CDN_BASE_URL'] || 'http://localhost:9000/public',
    videoService = options.videoService ??
      (videos ? new VideoService({ videos, cdnBaseUrl }) : undefined),
    probeQueue,
  } = options;

  if (!videoService) {
    throw new Error('registerVideosRoutes requires either videoService or videos repository');
  }

  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /v1/videos/:id and /videos/:id (SDD §6.1, §6.3, AC 2)
  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    server.get(
      path,
      {
        schema: {
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const user = request.user ?? null;
        const videoResponse = await videoService.get(user, id);
        return reply.status(200).send(videoResponse);
      }
    );
  }

  // POST /v1/videos/:id/reprocess and /videos/:id/reprocess (Ticket 16 AC 5)
  for (const path of ['/v1/videos/:id/reprocess', '/videos/:id/reprocess'] as const) {
    server.post(
      path,
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '1 minute',
            keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
            skip: (req: FastifyRequest) => req.user?.role === 'admin',
          },
        },
        schema: {
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          body: z
            .object({
              renditions: z.array(z.string()).optional(),
            })
            .nullish(),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;

        if (!videos) {
          throw new PermanentError(ErrorCodes.INTERNAL, 'Videos repository is not configured');
        }

        const video = await videos.findById(id);
        if (!video) {
          throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${id} not found`);
        }

        // Authorization: owner or admin only
        if (user.role !== 'admin' && video.ownerId !== user.id) {
          throw new PermanentError(
            ErrorCodes.FORBIDDEN,
            'Only the video owner or an admin may reprocess this video'
          );
        }

        // Allowed state check: READY, FAILED, PROCESSING
        const allowedFrom: VideoStatus[] = ['READY', 'FAILED', 'PROCESSING'];
        if (!allowedFrom.includes(video.status)) {
          throw new PermanentError(
            ErrorCodes.VALIDATION_FAILED,
            `Cannot reprocess video with status ${video.status}. Must be READY, FAILED, or PROCESSING.`
          );
        }

        // Bump generation (SDD §9.2)
        const nextGeneration = (video.generation || 1) + 1;

        const transitioned = await videos.transition({
          videoId: id,
          from: allowedFrom,
          to: 'PROBING',
          eventType: 'video.reprocessing',
          eventPayload: { generation: nextGeneration, requestedBy: user.id },
          patch: {
            generation: nextGeneration,
            errorCode: null,
            errorMessage: null,
          },
        });

        if (!transitioned) {
          throw new PermanentError(
            ErrorCodes.VERSION_CONFLICT,
            'State conflict while transitioning video to PROBING for reprocess'
          );
        }

        // Enqueue new probe job with fresh generation
        if (probeQueue) {
          const probeJobId = ids.probe(id, nextGeneration);
          const probeData = ProbeJob.parse({
            videoId: id,
            sourceKey: video.sourceKey,
            generation: nextGeneration,
            traceparent:
              (request.headers['traceparent'] as string) ||
              '00-00000000000000000000000000000001-0000000000000001-01',
          });

          await probeQueue.add('probe', probeData, {
            jobId: probeJobId,
            ...stagePolicies.probe,
            ...defaultJobOptions,
          });
        }

        return reply.status(202).send({
          videoId: id,
          status: 'PROBING',
          generation: nextGeneration,
        });
      }
    );
  }
}
