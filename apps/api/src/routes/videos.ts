import type { JobQueue, VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { problemResponse } from '../schemas/problem.js';
import {
  ListVideosQuerySchema,
  UpdateVideoMetadataSchema,
  VideoListResponseSchema,
  VideoSchema,
} from '../schemas/videos.js';
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

  // 1. GET /v1/videos (and /videos) — List caller videos (Ticket 19 AC 1, PRD US-12, SDD §6.1)
  for (const path of ['/v1/videos', '/videos'] as const) {
    const isAlias = path === '/videos';
    server.get(
      path,
      {
        schema: {
          tags: ['Videos'],
          summary: 'List caller videos with keyset pagination',
          description:
            'Keyset-paginated on (created_at, id), stable under concurrent inserts, scoped to the caller. nextCursor is opaque base64url.',
          querystring: ListVideosQuerySchema,
          response: {
            200: VideoListResponseSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await videoService.list(user, request.query);
        return reply.status(200).send(result);
      }
    );
  }

  // 2. GET /v1/videos/:id (and /videos/:id) — Detail (Ticket 19 AC 5, 7, SDD §6.1, §6.3)
  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    const isAlias = path === '/videos/:id';
    server.get(
      path,
      {
        schema: {
          tags: ['Videos'],
          summary: 'Get video details',
          description:
            'Retrieves full video details. Public/unlisted videos are readable by anyone; private videos require owner or admin authentication (returns 404 for non-owners). Public playback URL uses CDN (PRD OQ-2).',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          response: {
            200: VideoSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Invalid UUID'),
            401: problemResponse(
              [ErrorCodes.UNAUTHORIZED],
              'Authentication required for private video'
            ),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
          },
          ...(isAlias ? { hide: true } : {}),
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

  // 3. PATCH /v1/videos/:id (and /videos/:id) — Edit metadata (Ticket 19 AC 2, SDD §6.1)
  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    const isAlias = path === '/videos/:id';
    server.patch(
      path,
      {
        schema: {
          tags: ['Videos'],
          summary: 'Edit video metadata with optimistic locking',
          description:
            'Edits title, description, or visibility (private <-> unlisted <-> public). Requires expected version; returns 409 VERSION_CONFLICT if stale.',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          body: UpdateVideoMetadataSchema,
          response: {
            200: VideoSchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Only owner or admin may edit metadata'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
            409: problemResponse(
              [ErrorCodes.VERSION_CONFLICT],
              'Optimistic locking version conflict'
            ),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        const updated = await videoService.updateMetadata(user, id, request.body);
        return reply.status(200).send(updated);
      }
    );
  }

  // 4. DELETE /v1/videos/:id (and /videos/:id) — Soft delete (Ticket 17 AC 4, SDD §6.1)
  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    const isAlias = path === '/videos/:id';
    server.delete(
      path,
      {
        schema: {
          tags: ['Videos'],
          summary: 'Soft delete video',
          description:
            'Transitions video status to DELETED and enqueues housekeeping purge. Only owner or admin may delete.',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          response: {
            202: z.object({
              videoId: z.string().uuid(),
              status: z.literal('DELETED'),
            }),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Invalid video ID format'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Only owner or admin may delete video'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
            409: problemResponse([ErrorCodes.VERSION_CONFLICT], 'State conflict during deletion'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const { id } = request.params;
        const result = await videoService.softDelete(user, id);
        return reply.status(202).send(result);
      }
    );
  }

  // 5. POST /v1/videos/:id/reprocess (and /videos/:id/reprocess) — Re-run pipeline (Ticket 16 AC 5)
  for (const path of ['/v1/videos/:id/reprocess', '/videos/:id/reprocess'] as const) {
    const isAlias = path === '/videos/:id/reprocess';
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
          tags: ['Videos'],
          summary: 'Re-run transcoding pipeline',
          description:
            'Re-enqueues video into probe queue with an incremented generation. Owner or admin only; rate-limited.',
          params: z.object({
            id: z.string().uuid({ message: 'Invalid video ID format' }),
          }),
          body: z
            .object({
              renditions: z.array(z.string()).optional(),
            })
            .nullish(),
          response: {
            202: z.object({
              videoId: z.string().uuid(),
              status: z.literal('PROBING'),
              generation: z.number(),
            }),
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Only owner or admin may reprocess video'),
            404: problemResponse([ErrorCodes.VIDEO_NOT_FOUND], 'Video not found'),
            409: problemResponse([ErrorCodes.VERSION_CONFLICT], 'State conflict during reprocess'),
            422: problemResponse(
              [ErrorCodes.VALIDATION_FAILED],
              'Invalid video status for reprocess'
            ),
            429: problemResponse([ErrorCodes.RATE_LIMITED], 'Rate limit exceeded'),
          },
          ...(isAlias ? { hide: true } : {}),
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

        if (user.role !== 'admin' && video.ownerId !== user.id) {
          throw new PermanentError(
            ErrorCodes.FORBIDDEN,
            'Only the video owner or an admin may reprocess this video'
          );
        }

        const allowedFrom: VideoStatus[] = ['READY', 'FAILED', 'PROCESSING'];
        if (!allowedFrom.includes(video.status)) {
          throw new PermanentError(
            ErrorCodes.VALIDATION_FAILED,
            `Cannot reprocess video with status ${video.status}. Must be READY, FAILED, or PROCESSING.`
          );
        }

        const nextGeneration = (video.generation || 1) + 1;
        const probeJobId = ids.probe(id, nextGeneration);
        const probeData = ProbeJob.parse({
          videoId: id,
          sourceKey: video.sourceKey,
          generation: nextGeneration,
          traceparent:
            (request.headers['traceparent'] as string) ||
            '00-00000000000000000000000000000001-0000000000000001-01',
        });
        const probeJobOpts = {
          jobId: probeJobId,
          ...stagePolicies.probe,
          ...defaultJobOptions,
        };

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
          outbox: {
            kind: 'probe',
            payload: {
              type: 'queue',
              queueName: 'probe',
              job: {
                name: 'probe',
                data: probeData,
                opts: probeJobOpts,
              },
            },
          },
        });

        if (!transitioned) {
          throw new PermanentError(
            ErrorCodes.VERSION_CONFLICT,
            'State conflict while transitioning video to PROBING for reprocess'
          );
        }

        if (probeQueue) {
          await probeQueue.add('probe', probeData, probeJobOpts);
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
