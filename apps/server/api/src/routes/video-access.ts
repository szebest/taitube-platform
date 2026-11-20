import { isErr, ok } from '@kit/result';
import {
  clearVideoPassword,
  createVideoShareLink,
  listVideoShareLinks,
  revokeVideoShareLink,
  setVideoPassword,
  unlockVideo,
  videoAccessCookieName,
} from '@vp/api-contracts';
import { VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE } from '@vp/domain';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { httpOnlyCookie } from './http-only-cookie';
import { sendResult } from './send-result';

/**
 * Per client and video, so guessing one video's password neither spends nor shares another's tries.
 * The limiter runs before validation sees the id, and Postgres matches a uuid in any case, so the key
 * lower-cases it: otherwise every casing of one id would open a fresh bucket.
 */
function unlockKey(request: FastifyRequest): string {
  const { id } = request.params as { id: string };
  return `${request.ip}|${id.toLowerCase()}`;
}

export async function videoAccessRoutes(app: FastifyInstance): Promise<void> {
  const { shareLinkService, videoPasswordService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listVideoShareLinks.path,
    { schema: { ...contractSchema(listVideoShareLinks), params: listVideoShareLinks.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await shareLinkService.list(requireAuth(request), request.params.id)
      )
  );

  server.post(
    createVideoShareLink.path,
    {
      schema: {
        ...contractSchema(createVideoShareLink),
        params: createVideoShareLink.params,
        body: createVideoShareLink.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await shareLinkService.create(requireAuth(request), request.params.id, request.body),
        { status: createVideoShareLink.status }
      )
  );

  server.delete(
    revokeVideoShareLink.path,
    { schema: { ...contractSchema(revokeVideoShareLink), params: revokeVideoShareLink.params } },
    async (request, reply) => {
      const { id, linkId } = request.params;
      return sendResult(
        reply,
        request,
        await shareLinkService.revoke(requireAuth(request), id, linkId),
        { status: revokeVideoShareLink.status }
      );
    }
  );

  server.put(
    setVideoPassword.path,
    {
      schema: {
        ...contractSchema(setVideoPassword),
        params: setVideoPassword.params,
        body: setVideoPassword.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await videoPasswordService.set(
          requireAuth(request),
          request.params.id,
          request.body.password
        )
      )
  );

  server.delete(
    clearVideoPassword.path,
    { schema: { ...contractSchema(clearVideoPassword), params: clearVideoPassword.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await videoPasswordService.clear(requireAuth(request), request.params.id),
        { status: clearVideoPassword.status }
      )
  );

  server.post(
    unlockVideo.path,
    {
      config: {
        rateLimit: {
          max: VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE,
          timeWindow: '1 minute',
          keyGenerator: unlockKey,
        },
      },
      schema: {
        ...contractSchema(unlockVideo),
        params: unlockVideo.params,
        body: unlockVideo.body,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const unlocked = await videoPasswordService.unlock(
        request.user ?? null,
        id,
        request.body.password
      );
      if (isErr(unlocked)) return sendResult(reply, request, unlocked);

      const { credential, maxAgeSeconds } = unlocked.value;
      reply.header(
        'set-cookie',
        httpOnlyCookie(videoAccessCookieName(id), credential, {
          maxAgeSeconds,
          secure: request.protocol === 'https',
        })
      );
      return sendResult(reply, request, ok(null), { status: unlockVideo.status });
    }
  );
}
