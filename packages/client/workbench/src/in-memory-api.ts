import { type ApiClient, createApiClient } from '@vp/api-client';
import type { EndpointContract } from '@vp/api-contracts';

interface ApiCall {
  params: Readonly<Record<string, string>>;
  body: unknown;
}

/** One endpoint the in-memory API answers; `body` may return a promise, and `undefined` answers 204. */
export interface ApiReply {
  contract: Pick<EndpointContract, 'method' | 'path'>;
  body: (call: ApiCall) => unknown;
}

const NOT_FOUND = 404;

function matcher({ method, path }: ApiReply['contract']) {
  const names: string[] = [];
  const source = path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  const pattern = new RegExp(`^${source}$`);

  return (requestMethod: string, pathname: string) => {
    const found = requestMethod === method ? pattern.exec(pathname) : null;
    return (
      found &&
      Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(found[i + 1] ?? '')]))
    );
  };
}

/** A `fetch` that answers the contracts in `replies` and nothing else, so a story never leaves the page. */
function inMemoryFetch(replies: readonly ApiReply[]): typeof fetch {
  const routes = replies.map((reply) => ({ reply, match: matcher(reply.contract) }));

  return async (input, init) => {
    const method = init?.method ?? 'GET';
    const { pathname } = new URL(String(input));
    const sent = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;

    for (const { reply, match } of routes) {
      const params = match(method, pathname);
      if (params) {
        const answer = await reply.body({ params, body: sent });
        return answer === undefined ? new Response(null, { status: 204 }) : Response.json(answer);
      }
    }
    return new Response(null, { status: NOT_FOUND });
  };
}

export function inMemoryApi(replies: readonly ApiReply[]): ApiClient {
  return createApiClient({ baseUrl: globalThis.location.origin, fetch: inMemoryFetch(replies) });
}
