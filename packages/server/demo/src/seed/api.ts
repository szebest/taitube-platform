import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import { z } from 'zod';
import type { SeedFailure } from './failure';
import type { SeedPorts } from './ports';

export interface Actor {
  id: string;
  /** The `role` claim of the dev token: `user`, `creator`, `moderator` or `admin`. */
  role: string;
}

export interface ApiRequest {
  actor?: Actor;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean>;
  json?: unknown;
  text?: { body: string; contentType: string };
  /** Sent as `x-channel-id` by a studio request that acts on a channel. */
  channelId?: string;
}

export interface Api {
  send<T>(request: ApiRequest, schema: z.ZodType<T>): Promise<Result<T, SeedFailure>>;
}

const MAX_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 15_000;
const REQUEST_TIMEOUT_MS = 60_000;

const ProblemSchema = z.object({ code: z.string().optional(), detail: z.string().optional() });

function messageOf(body: string): string {
  try {
    const problem = ProblemSchema.parse(JSON.parse(body));
    return [problem.code, problem.detail].filter(Boolean).join(': ') || body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  const hinted = retryAfter !== null && Number.isFinite(seconds) ? seconds * 1000 : 0;
  return Math.min(MAX_BACKOFF_MS, Math.max(hinted, 1000 * 2 ** attempt));
}

/** The public API over a fetch port, signed in as a dev-token actor; a 429 waits and tries again. */
export function createApi(ports: SeedPorts, baseUrl: string): Api {
  const root = baseUrl.replace(/\/+$/, '');
  const tokens = new Map<string, string>();

  const headersFor = ({ actor, json, text, channelId }: ApiRequest): Record<string, string> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (actor) {
      const key = `${actor.id}:${actor.role}`;
      const token = tokens.get(key) ?? ports.signToken(actor.id, actor.role);
      tokens.set(key, token);
      headers.authorization = `Bearer ${token}`;
    }
    if (json !== undefined) headers['content-type'] = 'application/json';
    if (text) headers['content-type'] = text.contentType;
    if (channelId) headers['x-channel-id'] = channelId;
    return headers;
  };

  const urlFor = ({ path, query }: ApiRequest): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) search.set(key, String(value));
    const suffix = search.size > 0 ? `?${search}` : '';
    return `${root}${path}${suffix}`;
  };

  async function attempt(
    request: ApiRequest,
    number: number
  ): Promise<Result<string, SeedFailure>> {
    const { method, path } = request;
    const body =
      request.text?.body ?? (request.json === undefined ? undefined : JSON.stringify(request.json));
    const response = await fromPromise(
      () =>
        ports.fetch(urlFor(request), {
          method,
          headers: headersFor(request),
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
      (cause): SeedFailure => ({
        kind: 'network',
        method,
        path,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    );
    if (isErr(response)) return response;

    const text = await response.value.text();
    if (response.value.status === 429 && number < MAX_ATTEMPTS) {
      await ports.clock.sleep(backoffMs(number, response.value.headers.get('retry-after')));
      return attempt(request, number + 1);
    }
    return response.value.ok
      ? ok(text)
      : err({
          kind: 'http',
          method,
          path,
          status: response.value.status,
          message: messageOf(text),
        });
  }

  return {
    async send(request, schema) {
      const text = await attempt(request, 1);
      if (isErr(text)) return text;
      const parsed = schema.safeParse(text.value === '' ? undefined : JSON.parse(text.value));
      return parsed.success
        ? ok(parsed.data)
        : err({
            kind: 'invalid',
            message: `${request.method} ${request.path} answered an unexpected body: ${parsed.error.message.slice(0, 200)}`,
          });
    },
  };
}
