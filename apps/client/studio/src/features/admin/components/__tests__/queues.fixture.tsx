import { discardDlqEntry, listDlq, replayDlqEntry } from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw';

import { signInBrowser } from '#app/__tests__/providers';
import type { DlqEntry } from '#app/features/admin/api/admin-dlq';
import { getRouter } from '#app/router';

let sequence = 0;

export function dlqEntry(overrides: Partial<DlqEntry> = {}): DlqEntry {
  sequence += 1;
  return {
    id: `dlq-${sequence}`,
    queue: 'transcode',
    jobId: `job-${sequence}`,
    attemptsMade: 3,
    status: 'PARKED',
    errorCode: 'FFMPEG_FAILED',
    errorMessage: 'ffmpeg exited with 1',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** The first page of the entries `status` asks for, the way the API filters them. */
export const dlqList = (entries: DlqEntry[], queries: URLSearchParams[] = []) =>
  mockEndpoint(listDlq, ({ request }) => {
    const { searchParams } = new URL(request.url);
    queries.push(searchParams);
    const status = searchParams.get('status');
    return HttpResponse.json({
      items: entries.filter((entry) => !status || entry.status === status),
      nextCursor: null,
    });
  });

interface Requests {
  queries: URLSearchParams[];
  replayed: string[];
  discarded: string[];
}

/** `/admin/queues` as an admin sees it, over `entries`, with replay and discard recorded and answered. */
export async function renderQueues(
  url: string,
  entries: DlqEntry[],
  { handlers = [] }: { handlers?: HttpHandler[] } = {}
) {
  const requests: Requests = { queries: [], replayed: [], discarded: [] };
  const rendered = await renderRoute(getRouter, url, {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      ...handlers,
      dlqList(entries, requests.queries),
      mockEndpoint(replayDlqEntry, ({ params }) => {
        requests.replayed.push(String(params['id']));
        return HttpResponse.json(
          { status: 'REPLAYED' as const, dlqEntryId: String(params['id']), replayJobId: 'r1' },
          { status: 202 }
        );
      }),
      mockEndpoint(discardDlqEntry, ({ params }) => {
        requests.discarded.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, requests };
}
