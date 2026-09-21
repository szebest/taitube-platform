import { type EndpointContract, problemResponse } from '@vp/api-contracts';
import type { z } from 'zod';

export interface ContractSchemaOptions {
  hide?: boolean;
  responses?: Record<number, z.ZodTypeAny>;
}

export interface ContractSchema {
  tags: string[];
  summary: string;
  description: string;
  response: Record<number, z.ZodTypeAny>;
  security?: never[];
  hide?: boolean;
}

/**
 * Renders the transport-independent half of a Fastify route schema from its
 * `@vp/api-contracts` entry. `params`, `querystring` and `body` stay at the call
 * site so the Zod type provider keeps inferring the handler's request types —
 * the drift test asserts each one is the very schema the contract declares.
 */
export function contractSchema(
  contract: EndpointContract,
  options: ContractSchemaOptions = {}
): ContractSchema {
  const response: Record<number, z.ZodTypeAny> = {
    [contract.status]: contract.result,
    ...options.responses,
  };

  for (const [status, codes] of Object.entries(contract.errors)) {
    response[Number(status)] = problemResponse(codes);
  }

  return {
    tags: [contract.tag],
    summary: contract.summary,
    description: contract.description,
    response,
    ...(contract.anonymous ? { security: [] } : {}),
    ...(options.hide ? { hide: true } : {}),
  };
}

export interface ContractPath {
  path: string;
  hide: boolean;
}

/**
 * Every path a contract is served on: the versioned one it declares plus the
 * unprefixed alias kept for older clients. The alias is the only thing hidden
 * from the OpenAPI document, so its `hide` flag travels with the path instead of
 * being re-derived from a repeated string literal at each registration.
 */
export function contractPaths(contract: EndpointContract): readonly ContractPath[] {
  const alias = contract.path.replace(/^\/v1(?=\/)/, '');
  if (alias === contract.path) {
    return [{ path: contract.path, hide: false }];
  }
  return [
    { path: contract.path, hide: false },
    { path: alias, hide: true },
  ];
}
