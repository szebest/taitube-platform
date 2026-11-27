import {
  SHARE_TOKEN_PARAM,
  bulkEditCreatorVideos,
  createVideoCorrection,
  deleteVideoCorrection,
  getChapterSuggestions,
  listVideoCorrections,
  listVideoRevisions,
  replaceVideoChapters,
  restoreVideoRevision,
  updateVideoCorrection,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';
import { GATED_READ_HEADERS, videoAccessOf } from './video-access-request';
import { presentPublicVideoFailure } from './videos.presenter';

export async function videoToolsRoutes(app: FastifyInstance): Promise<void> {
  const {
    videoBulkEditService,
    videoRevisionService,
    chapterService,
    videoCorrectionService: corrections,
  } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    bulkEditCreatorVideos.path,
    { schema: { ...contractSchema(bulkEditCreatorVideos), body: bulkEditCreatorVideos.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await videoBulkEditService.edit(requireAuth(request), request.body)
      )
  );

  server.get(
    listVideoRevisions.path,
    {
      schema: {
        ...contractSchema(listVideoRevisions),
        params: listVideoRevisions.params,
        querystring: listVideoRevisions.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await videoRevisionService.list(requireAuth(request), request.params.id, request.query),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      )
  );

  server.post(
    restoreVideoRevision.path,
    {
      schema: {
        ...contractSchema(restoreVideoRevision),
        params: restoreVideoRevision.params,
        body: restoreVideoRevision.body,
      },
    },
    async (request, reply) => {
      const { id, revisionId } = request.params;
      return sendResult(
        reply,
        request,
        await videoRevisionService.restore(
          requireAuth(request),
          id,
          revisionId,
          request.body.version
        ),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      );
    }
  );

  server.get(
    getChapterSuggestions.path,
    { schema: { ...contractSchema(getChapterSuggestions), params: getChapterSuggestions.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await chapterService.suggest(requireAuth(request), request.params.id),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      )
  );

  server.put(
    replaceVideoChapters.path,
    {
      schema: {
        ...contractSchema(replaceVideoChapters),
        params: replaceVideoChapters.params,
        body: replaceVideoChapters.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await chapterService.replace(requireAuth(request), request.params.id, request.body),
        { present: (failure) => presentPublicVideoFailure(failure, request.url) }
      )
  );

  server.get(
    listVideoCorrections.path,
    {
      schema: {
        ...contractSchema(listVideoCorrections),
        params: listVideoCorrections.params,
        querystring: listVideoCorrections.query,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const access = videoAccessOf(request, id, request.query[SHARE_TOKEN_PARAM]);
      reply.headers(GATED_READ_HEADERS);
      return sendResult(reply, request, await corrections.list(request.user ?? null, id, access), {
        present: (failure) => presentPublicVideoFailure(failure, request.url),
      });
    }
  );

  server.post(
    createVideoCorrection.path,
    {
      schema: {
        ...contractSchema(createVideoCorrection),
        params: createVideoCorrection.params,
        body: createVideoCorrection.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await corrections.create(requireAuth(request), request.params.id, request.body),
        { status: createVideoCorrection.status }
      )
  );

  server.patch(
    updateVideoCorrection.path,
    {
      schema: {
        ...contractSchema(updateVideoCorrection),
        params: updateVideoCorrection.params,
        body: updateVideoCorrection.body,
      },
    },
    async (request, reply) => {
      const { id, correctionId } = request.params;
      return sendResult(
        reply,
        request,
        await corrections.update(requireAuth(request), id, correctionId, request.body),
        { status: updateVideoCorrection.status }
      );
    }
  );

  server.delete(
    deleteVideoCorrection.path,
    {
      schema: {
        ...contractSchema(deleteVideoCorrection),
        params: deleteVideoCorrection.params,
      },
    },
    async (request, reply) => {
      const { id, correctionId } = request.params;
      return sendResult(
        reply,
        request,
        await corrections.remove(requireAuth(request), id, correctionId),
        { status: deleteVideoCorrection.status }
      );
    }
  );
}
