import { listCommentReports, resolveCommentReport } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../../plugins/auth';
import { contractPaths, contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';

export async function adminReportsRoutes(app: FastifyInstance): Promise<void> {
  const { commentReportService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listCommentReports)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listCommentReports, { hide }),
          querystring: listCommentReports.query,
        },
      },
      async (request, reply) => {
        const admin = requireAuth(request);
        return sendResult(reply, request, await commentReportService.list(admin, request.query));
      }
    );
  }

  for (const { path, hide } of contractPaths(resolveCommentReport)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(resolveCommentReport, { hide }),
          params: resolveCommentReport.params,
          body: resolveCommentReport.body,
        },
      },
      async (request, reply) => {
        const admin = requireAuth(request);
        return sendResult(
          reply,
          request,
          await commentReportService.resolve(admin, request.params.id, request.body.resolution)
        );
      }
    );
  }
}
