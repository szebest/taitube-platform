import { type Result, err, isErr, ok } from '@kit/result';
import { SESSION_COOKIE, contracts, endpointKey, isEndpoint } from '@vp/api-contracts';
import type { ApiScope } from '@vp/domain';
import { type ApiTokenRefused, apiTokenRefused, channelMembershipRequired } from '@vp/domain-rules';
import type { TokenGrant } from '@vp/permissions';
import { parseCookie } from 'cookie-es';
import type { FastifyRequest } from 'fastify';
import { contractPaths } from '../routes/contract-schema';
import type { Identity } from '../services/request-identity';

/** Whether the request also carries the session cookie the client apps keep. */
export function carriesSession(request: FastifyRequest): boolean {
  const { cookie } = request.headers;
  return cookie !== undefined && parseCookie(cookie)[SESSION_COOKIE] !== undefined;
}

/** The scope each route names, under its versioned path and its unprefixed alias alike. */
export function routeScopes(): ReadonlyMap<string, ApiScope> {
  return new Map(
    Object.values(contracts)
      .flatMap((group) => Object.values(group).filter(isEndpoint))
      .flatMap((endpoint) => {
        const { method, scope } = endpoint;
        if (!scope) return [];
        return contractPaths(endpoint).map(
          ({ path }) => [endpointKey(method, path), scope] as const
        );
      })
  );
}

/**
 * A token acts on its own channel and nowhere else: a member removed from it, or an `X-Channel-Id`
 * naming another, finds the token out of reach.
 */
export function tokenIdentity(
  { user, acting }: Identity,
  { channelId }: TokenGrant,
  requested: string | undefined
): Result<Identity, ApiTokenRefused> {
  if (isErr(acting)) return err(apiTokenRefused('the token channel is out of reach'));
  if (requested === undefined || requested === channelId) return ok({ user, acting });
  return ok({ user, acting: err(channelMembershipRequired(requested)) });
}
