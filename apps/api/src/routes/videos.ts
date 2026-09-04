import type { VideoRepository } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { VideoService } from '../services/video-service.js';

export interface VideosRouteOptions {
  videos?: VideoRepository;
  cdnBaseUrl?: string;
  videoService?: VideoService;
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
  } = options;

  if (!videoService) {
    throw new Error('registerVideosRoutes requires either videoService or videos repository');
  }

  const server = app.withTypeProvider<ZodTypeProvider>();

  // GET /v1/videos/:id (SDD §6.1, §6.3, AC 2)
  server.get(
    '/v1/videos/:id',
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
