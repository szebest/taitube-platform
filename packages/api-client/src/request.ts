import { type EndpointContract, buildPath, endpointKey } from '@vp/api-contracts';
import { ApiContractError, toApiError } from './api-error.js';

export interface ApiClientOptions {
  /** Root of the API, e.g. `http://localhost:3000`. No trailing slash required. */
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  credentials?: RequestCredentials;
  getAuthToken?: () => string | null | undefined;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  params?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function toSearchParams(query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(key, String(item));
    }
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

export async function sendRequest(
  client: ApiClientOptions,
  contract: EndpointContract,
  options: RequestOptions = {}
): Promise<unknown> {
  const doFetch = client.fetch ?? globalThis.fetch;
  const url =
    client.baseUrl.replace(/\/+$/, '') +
    buildPath(contract.path, options.params) +
    toSearchParams(options.query ?? {});

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...client.headers,
    ...options.headers,
  };

  const token = client.getAuthToken?.();
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    headers['content-type'] = 'application/json';
  }

  const response = await doFetch(url, {
    method: contract.method,
    headers,
    ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
    ...(client.credentials ? { credentials: client.credentials } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw toApiError(response.status, await readBody(response));
  }

  if (response.status === 204) {
    return undefined;
  }

  const parsed = contract.result.safeParse(await readBody(response));
  if (!parsed.success) {
    throw new ApiContractError(
      endpointKey(contract.method, contract.path),
      parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
    );
  }

  return parsed.data;
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    return response.json();
  }
  return response.text();
}
