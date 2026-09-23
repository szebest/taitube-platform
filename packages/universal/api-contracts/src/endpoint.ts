import type { ErrorCode } from '@vp/errors';
import { z } from 'zod';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type ErrorResponses = Readonly<Record<number, readonly ErrorCode[]>>;

export interface EndpointContract {
  readonly method: HttpMethod;
  readonly path: string;
  readonly tag: string;
  readonly summary: string;
  readonly description: string;
  readonly anonymous?: boolean;
  readonly params?: z.ZodTypeAny;
  readonly query?: z.ZodTypeAny;
  readonly body?: z.ZodTypeAny;
  readonly status: number;
  readonly result: z.ZodTypeAny;
  readonly errors: ErrorResponses;
}

export type ContractParams<T extends EndpointContract> = T['params'] extends z.ZodTypeAny
  ? z.infer<T['params']>
  : undefined;
export type ContractQuery<T extends EndpointContract> = T['query'] extends z.ZodTypeAny
  ? z.input<T['query']>
  : undefined;
export type ContractBody<T extends EndpointContract> = T['body'] extends z.ZodTypeAny
  ? z.infer<T['body']>
  : undefined;
export type ContractResult<T extends EndpointContract> = z.infer<T['result']>;

/**
 * The generic is what keeps `contract.params` a concrete Zod schema rather than
 * `ZodTypeAny | undefined`; annotate a contract as `EndpointContract` instead and
 * the Fastify type provider widens every derived handler's `request.params` to
 * `unknown`.
 */
export function defineEndpoint<T extends EndpointContract>(contract: T): T {
  return contract;
}

/**
 * Fills `:name` placeholders in a contract path. The client and the drift test
 * both key on the placeholder form, so substitution stays in one place.
 */
export function buildPath(path: string, params: Record<string, string | number> = {}): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${path}`);
    }
    return encodeURIComponent(String(value));
  });
}

const EndpointShapeSchema = z.object({
  method: z.enum(HTTP_METHODS),
  path: z.string(),
  result: z.instanceof(z.ZodType),
});

/** Whether an exported member of a contract group is an endpoint rather than a schema or type. */
export function isEndpoint(value: unknown): value is EndpointContract {
  return EndpointShapeSchema.safeParse(value).success;
}
