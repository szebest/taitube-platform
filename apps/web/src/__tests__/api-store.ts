import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../base-api';

export function createApiStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export type ApiStore = ReturnType<typeof createApiStore>;

export type SentRequest = {
  method: string;
  url: string;
  body: unknown;
};

type Respond = (url: string) => Response;

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function readBody(init: RequestInit): unknown {
  if (typeof init.body !== 'string') return undefined;
  return JSON.parse(init.body);
}

/** Replaces `fetch` for one test and returns the requests the API client sends through it. */
export function recordRequests(respond: Respond = noContent): SentRequest[] {
  const sent: SentRequest[] = [];

  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ method: String(init.method), url, body: readBody(init) });
    return respond(url);
  });

  return sent;
}

export function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

/** Fills a query's cache entry by letting it fetch `body`, so the cache holds what the contract parsed. */
export async function seed(
  store: ApiStore,
  query: (store: ApiStore) => unknown,
  body: unknown
): Promise<void> {
  recordRequests(() => jsonResponse(body));
  await query(store);
}
