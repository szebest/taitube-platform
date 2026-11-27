import { CHANNEL_HEADER, type EndpointContract, problemResponse } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';

export interface ContractSchemaOptions {
  hide?: boolean;
  responses?: Record<number, z.ZodType>;
}

export interface ContractSchema {
  tags: string[];
  summary: string;
  description: string;
  response: Record<number, z.ZodType>;
  headers?: z.ZodType;
  security?: SecurityRequirement[];
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
  const response: Record<number, z.ZodType> = {
    [contract.status]: contract.result,
    ...options.responses,
  };

  for (const [status, codes] of Object.entries(errorsOf(contract))) {
    response[Number(status)] = problemResponse(codes);
  }

  return {
    tags: [contract.tag],
    summary: contract.summary,
    description: contract.description,
    response,
    ...(contract.channelScoped ? { headers: CHANNEL_HEADERS } : {}),
    ...securityOf(contract),
    ...(options.hide || contract.internal ? { hide: true } : {}),
  };
}

type SecurityRequirement = Readonly<Record<string, readonly string[]>>;

/**
 * An anonymous route asks for nothing; a route a token may call names its scope as the role the
 * `personalAccessToken` scheme needs (OpenAPI 3.1 lets a non-OAuth scheme list roles).
 */
function securityOf({ anonymous, scope }: EndpointContract): { security?: SecurityRequirement[] } {
  if (!scope) return anonymous ? { security: [] } : {};
  return { security: [anonymous ? {} : { bearerAuth: [] }, { personalAccessToken: [scope] }] };
}

/** Loose, because Fastify replaces the request headers with what the schema lets through. */
const CHANNEL_HEADERS = z.looseObject({ [CHANNEL_HEADER]: z.uuid().optional() });

type Errors = EndpointContract['errors'];

const CHANNEL_REFUSALS: Errors = {
  403: [ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED, ErrorCodes.FORBIDDEN],
};

/** What the auth hook answers a personal access token on any route that names a scope. */
const TOKEN_REFUSALS: Errors = {
  400: [ErrorCodes.API_TOKEN_WITH_SESSION],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.API_TOKEN_SCOPE_MISSING],
  429: [ErrorCodes.RATE_LIMITED],
};

function merged(errors: Errors, added: Errors): Errors {
  const statuses = new Set([...Object.keys(errors), ...Object.keys(added)].map(Number));
  return Object.fromEntries(
    [...statuses].map((status) => [
      status,
      [...new Set([...(errors[status] ?? []), ...(added[status] ?? [])])],
    ])
  );
}

function errorsOf(contract: EndpointContract): Errors {
  const scoped = contract.channelScoped
    ? merged(contract.errors, CHANNEL_REFUSALS)
    : contract.errors;
  return contract.scope ? merged(scoped, TOKEN_REFUSALS) : scoped;
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
