import {
  cancelPick,
  createPick,
  listAdminPicks,
  listAdminVideos,
  PROBLEM_CONTENT_TYPE,
  type Problem,
  problemDetails,
  updatePick,
} from '@vp/api-contracts';
import { account, mockEndpoint, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw';

import { signInBrowser } from '#app/__tests__/providers';
import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { getRouter } from '#app/router';
import { adminVideo } from './moderation.fixture';

const HOUR_MS = 3_600_000;

/** An ISO instant `hours` from now, so a spec never depends on the date it runs. */
export const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

let sequence = 0;

/** A pick that starts tomorrow and runs a day, on a public ready video. */
export function adminPick(overrides: Partial<AdminPick> = {}): AdminPick {
  sequence += 1;
  return {
    id: `0190c3a0-5e1d-7000-8000-0000000e${String(sequence).padStart(4, '0')}`,
    videoId: '0190c3a0-5e1d-7000-8000-00000000a001',
    startsAt: inHours(24),
    endsAt: inHours(48),
    note: 'Start here',
    createdBy: '0190c3a0-5e1d-7000-8000-00000000b001',
    createdAt: '2026-10-01T00:00:00.000Z',
    video: videoSummary({ title: 'Mountain lakes' }),
    ...overrides,
  };
}

export const CATS = adminVideo({
  id: '0190c3a0-5e1d-7000-8000-00000000a002',
  title: 'Cats at dawn',
});
export const OCEAN = adminVideo({
  id: '0190c3a0-5e1d-7000-8000-00000000a003',
  title: 'Ocean floor',
});

/** The 422 the API answers when it refuses one input, naming it. */
export function refusedField(
  field: 'videoId' | 'startsAt' | 'endsAt' | 'note'
): HttpResponse<Problem> {
  return HttpResponse.json<Problem>(
    problemDetails({
      code: 'VALIDATION_FAILED',
      status: 422,
      title: 'Invalid',
      detail: 'Invalid',
      instance: 'msw',
      errors: [{ field, message: 'refused' }],
    }),
    { status: 422, headers: { 'content-type': PROBLEM_CONTENT_TYPE } }
  );
}

interface Requests {
  created: unknown[];
  updated: { id: string; body: unknown }[];
  cancelled: string[];
}

/** `/admin/curation` as an admin sees it over `picks`, with the pickable videos listed and the writes recorded and answered. */
export async function renderCuration(
  picks: AdminPick[],
  { handlers = [] }: { handlers?: HttpHandler[] } = {}
) {
  const requests: Requests = { created: [], updated: [], cancelled: [] };
  const rendered = await renderRoute(getRouter, '/admin/curation', {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      ...handlers,
      mockEndpoint(listAdminPicks, () => HttpResponse.json({ items: picks })),
      mockEndpoint(listAdminVideos, ({ request }) => {
        const text = new URL(request.url).searchParams.get('q')?.toLowerCase();
        const items = [CATS, OCEAN].filter(
          ({ title }) => !text || title?.toLowerCase().includes(text)
        );
        return HttpResponse.json({ items, nextCursor: null });
      }),
      mockEndpoint(createPick, async ({ request }) => {
        requests.created.push(await request.json());
        return HttpResponse.json(adminPick(), { status: 201 });
      }),
      mockEndpoint(updatePick, async ({ request, params }) => {
        requests.updated.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(adminPick());
      }),
      mockEndpoint(cancelPick, ({ params }) => {
        requests.cancelled.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, requests };
}
