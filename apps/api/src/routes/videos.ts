import { type Database, getVideoWithDetails } from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export interface VideosRouteOptions {
  db: Database;
  cdnBaseUrl?: string;
}

export function registerVideosRoutes(app: FastifyInstance, options: VideosRouteOptions): void {
  const { db, cdnBaseUrl = process.env.CDN_BASE_URL || 'http://localhost:9000/public' } = options;
  const cleanCdnBase = cdnBaseUrl.replace(/\/+$/, '');

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

      const details = await getVideoWithDetails(db, id);
      if (!details) {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${id} not found`);
      }

      const { video, renditions: videoRenditions } = details;

      // Access control (SDD §6.1, §11, AC 2):
      // - If private: must be authenticated and owner (or admin); other owner + private -> 404
      // - If unlisted or public: viewable by anyone -> 200
      if (video.visibility === 'private') {
        if (!request.user) {
          throw new PermanentError(
            ErrorCodes.UNAUTHORIZED,
            'Authentication required to view private video'
          );
        }

        if (request.user.id !== video.ownerId && request.user.role !== 'admin') {
          // Do not leak existence: return 404 VIDEO_NOT_FOUND for non-owners
          throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${id} not found`);
        }
      }

      // Format response according to SDD §6.3
      const isReady = video.status === 'READY';
      const byRendition: Record<string, number> = {};
      for (const r of videoRenditions) {
        byRendition[r.name] = r.status === 'DONE' ? 100 : 0;
      }

      const renditionsResponse = videoRenditions.map((r) => ({
        name: r.name,
        status: r.status,
        playlistUrl: r.playlistKey
          ? `${cleanCdnBase}/${r.playlistKey.replace(/^\/+/, '')}`
          : undefined,
      }));

      const videoResponse = {
        id: video.id,
        title: video.title,
        description: video.description,
        visibility: video.visibility,
        status: video.status,
        progress: {
          overall: isReady ? 100 : 0,
          byRendition,
        },
        durationMs: video.durationMs ?? undefined,
        width: video.width ?? undefined,
        height: video.height ?? undefined,
        ladder:
          (video.ladder as unknown as Array<{
            name: string;
            width: number;
            height: number;
            videoKbps: number;
            audioKbps: number;
          }>) ?? undefined,
        renditions: renditionsResponse,
        playbackUrl:
          isReady && video.masterPlaylistKey
            ? `${cleanCdnBase}/${video.masterPlaylistKey.replace(/^\/+/, '')}`
            : undefined,
        posterUrl: video.posterKey
          ? `${cleanCdnBase}/${video.posterKey.replace(/^\/+/, '')}`
          : undefined,
        spriteUrl: video.spriteKey
          ? `${cleanCdnBase}/${video.spriteKey.replace(/^\/+/, '')}`
          : undefined,
        spriteVttUrl: video.spriteKey
          ? `${cleanCdnBase}/${video.spriteKey.replace(/\.[^.]+$/, '.vtt').replace(/^\/+/, '')}`
          : undefined,
        error: video.errorCode
          ? { code: video.errorCode, message: video.errorMessage || '' }
          : undefined,
        version: video.version,
        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString(),
        readyAt: video.readyAt ? video.readyAt.toISOString() : undefined,
      };

      return reply.status(200).send(videoResponse);
    }
  );
}
