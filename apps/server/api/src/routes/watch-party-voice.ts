import {
  createWatchPartyVoiceToken,
  receiveVoiceWebhook,
  removeWatchPartyVoiceMember,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

/** LiveKit posts `application/webhook+json`, signed over the exact body, so it is kept as the string it arrived as. */
const WEBHOOK_BODY = ['application/webhook+json', 'application/json'];

export async function watchPartyVoiceRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyVoiceService } = app.services;
  if (watchPartyVoiceService === null) return;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createWatchPartyVoiceToken.path,
    {
      schema: {
        ...contractSchema(createWatchPartyVoiceToken),
        params: createWatchPartyVoiceToken.params,
        body: createWatchPartyVoiceToken.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await watchPartyVoiceService.token(
          request.params.id,
          partyCallerOf(request),
          request.body?.listenOnly ?? false
        ),
        { status: createWatchPartyVoiceToken.status }
      )
  );

  server.post(
    removeWatchPartyVoiceMember.path,
    {
      schema: {
        ...contractSchema(removeWatchPartyVoiceMember),
        params: removeWatchPartyVoiceMember.params,
      },
    },
    async (request, reply) => {
      requireAuth(request);
      const { id, memberKey } = request.params;
      return sendResult(
        reply,
        request,
        await watchPartyVoiceService.remove(id, partyCallerOf(request), memberKey),
        { status: removeWatchPartyVoiceMember.status }
      );
    }
  );

  await app.register(async (hook) => {
    hook.addContentTypeParser(WEBHOOK_BODY, { parseAs: 'string' }, (_request, body, done) => {
      done(null, body);
    });
    hook
      .withTypeProvider<ZodTypeProvider>()
      .post(
        receiveVoiceWebhook.path,
        { schema: { ...contractSchema(receiveVoiceWebhook), body: receiveVoiceWebhook.body } },
        async (request, reply) =>
          sendResult(
            reply,
            request,
            await watchPartyVoiceService.webhook(request.body, request.headers.authorization),
            { status: receiveVoiceWebhook.status }
          )
      );
  });
}
