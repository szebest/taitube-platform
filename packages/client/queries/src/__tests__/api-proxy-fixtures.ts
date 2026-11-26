import type { RefreshSession } from '@kit/query';
import { requestHandler } from '@tanstack/react-start/server';
import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { proxyToApi } from '../api-proxy';

export const API = 'http://api.internal:3000';
export const APP = 'http://localhost:5173';
export const VIDEO = '0190c3a0-5e1d-7000-8000-00000000a001';
export const BODY_LIMIT_BYTES = 1_048_576;

export type Sent = { url: string; method: string; headers: Headers; body: string };

/** The API behind the proxy: records what reached it and answers each call with the next reply. */
export function api(...replies: (() => Response)[]): Sent[] {
  const sent: Sent[] = [];
  apiServer.use(
    http.all(`${API}/*`, async ({ request }) => {
      sent.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.text(),
      });
      return (replies[sent.length - 1] ?? (() => HttpResponse.json({ ok: true })))();
    })
  );
  return sent;
}

export const refused = () => HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

export type Call = {
  app?: string;
  init?: RequestInit;
  clientAddress?: string;
  refresh?: RefreshSession;
  onRequest?: (request: Request) => void;
  /** The slot the call names; `null` for a call that names none. */
  slot?: number | null;
};

/** A browser's call to the app's `/api`, answered the way the app's server answers it. */
export function callProxy(
  path: string,
  { app = APP, init = {}, clientAddress, refresh, onRequest, slot = 0 }: Call = {}
) {
  const request = Object.assign(new Request(`${app}${path}`, init), { ip: clientAddress });
  onRequest?.(request);
  const named = { pathname: new URL(request.url).pathname, slot: slot ?? undefined };
  return requestHandler(() => proxyToApi(request, { apiBaseUrl: API, refresh }, named))(
    request,
    {}
  );
}

export const cookieNames = (answer: Response) =>
  answer.headers.getSetCookie().map((set) => set.split(';')[0]);
