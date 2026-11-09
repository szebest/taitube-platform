import {
  joinWatchPartyAsGuest,
  PARTY_CREDENTIAL_HEADER,
  PARTY_GUEST_COOKIE,
  upgradeWatchPartySeat,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { isErr, ok } from '@vp/result';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { partyCallerOf } from './party-caller';
import { sendResult } from './send-result';

function guestCookie(credential: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${PARTY_GUEST_COOKIE}=${credential}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export async function watchPartyGuestsRoutes(app: FastifyInstance): Promise<void> {
  const { watchPartyGuestService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    joinWatchPartyAsGuest.path,
    {
      schema: {
        ...contractSchema(joinWatchPartyAsGuest),
        params: joinWatchPartyAsGuest.params,
        body: joinWatchPartyAsGuest.body,
      },
    },
    async (request, reply) => {
      const joined = await watchPartyGuestService.join(
        request.params.id,
        partyCallerOf(request),
        request.body
      );
      if (isErr(joined)) {
        return sendResult(reply, request, joined, {
          headers: (failure): Record<string, string> =>
            failure.code === ErrorCodes.RATE_LIMITED
              ? { 'retry-after': String(failure.retryAfterSeconds) }
              : {},
        });
      }
      const { credential, maxAgeSeconds, ...body } = joined.value;
      reply.header(
        'set-cookie',
        guestCookie(credential, maxAgeSeconds, request.protocol === 'https')
      );
      return sendResult(reply, request, ok(body), { status: joinWatchPartyAsGuest.status });
    }
  );

  server.post(
    upgradeWatchPartySeat.path,
    {
      schema: { ...contractSchema(upgradeWatchPartySeat), params: upgradeWatchPartySeat.params },
    },
    async (request, reply) => {
      const credential = request.headers[PARTY_CREDENTIAL_HEADER];
      return sendResult(
        reply,
        request,
        await watchPartyGuestService.upgrade(
          request.params.id,
          partyCallerOf(request),
          typeof credential === 'string' ? credential : null
        )
      );
    }
  );
}
