import { reportComment } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function commentReportsRoutes(app: FastifyInstance): Promise<void> {
  const { commentReportService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(reportComment)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(reportComment, { hide }),
          params: reportComment.params,
          body: reportComment.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(
          reply,
          request,
          await commentReportService.report(user, request.params.id, request.body),
          { status: 201 }
        );
      }
    );
  }
}
