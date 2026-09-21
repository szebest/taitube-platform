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
