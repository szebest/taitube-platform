import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'video-pipeline API',
        description:
          'Asynchronous video ingestion and HLS transcoding API. All video playback assets (master and media playlists, segments) are served via public CDN.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Dev or production bearer JWT',
          },
          adminToken: {
            type: 'apiKey',
            in: 'header',
            name: 'x-admin-token',
            description: 'Static admin token for administrative operations',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      pageTitle: 'video-pipeline API Documentation',
    },
  });

  app.get('/openapi.json', { schema: { hide: true } }, async (_req, reply) => {
    return reply.header('Content-Type', 'application/json').send(app.swagger());
  });
}
