import { deleteVideo, getVideo, listVideos, reprocessVideo, updateVideo } from '@vp/api-contracts';
import type { JobQueue, VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import { canAccessAdmin, canUpdateVideo, parseRole } from '@vp/permissions';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { VideoService } from '../services/video-service';
import { contractSchema } from './contract-schema';

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

  for (const path of ['/v1/videos', '/videos'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listVideos, { hide: path === '/videos' }),
          querystring: listVideos.query,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        const result = await videoService.list(user, request.query);
        return reply.status(200).send(result);
      }
    );
  }

  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getVideo, { hide: path === '/videos/:id' }),
          params: getVideo.params,
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

  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    server.patch(
      path,
      {
        schema: {
          ...contractSchema(updateVideo, { hide: path === '/videos/:id' }),
          params: updateVideo.params,
          body: updateVideo.body,
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

  for (const path of ['/v1/videos/:id', '/videos/:id'] as const) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(deleteVideo, { hide: path === '/videos/:id' }),
          params: deleteVideo.params,
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

  for (const path of ['/v1/videos/:id/reprocess', '/videos/:id/reprocess'] as const) {
    server.post(
      path,
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: '1 minute',
            keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
            skip: (req: FastifyRequest) =>
              req.user
                ? canAccessAdmin({ user: { id: req.user.id, role: parseRole(req.user.role) } })
                : false,
          },
        },
        schema: {
          ...contractSchema(reprocessVideo, { hide: path === '/videos/:id/reprocess' }),
          params: reprocessVideo.params,
          body: reprocessVideo.body,
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

        request.assertCan(
          canUpdateVideo,
          { video },
          'Only the video owner or an admin may reprocess this video'
        );

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
