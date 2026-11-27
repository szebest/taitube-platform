import {
  approveHeldVideo,
  dismissScreeningFlags,
  listScreeningCases,
  rejectHeldVideo,
} from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw';
import { signInBrowser } from '#app/__tests__/providers';
import type { ScreeningCase, ScreeningFinding } from '#app/features/admin/api/admin-screening';
import { getRouter } from '#app/router';

let sequence = 0;

const uuid = (kind: number) =>
  `0190c3a0-5e1d-7000-8000-${String(kind).padStart(4, '0')}${String(sequence).padStart(8, '0')}`;

export function screeningFinding(overrides: Partial<ScreeningFinding> = {}): ScreeningFinding {
  return {
    reason: 'DUPLICATE',
    score: 0.93,
    match: null,
    frames: [],
    flaggedShare: null,
    signals: [],
    profanity: [],
    ...overrides,
  };
}

export const MATCHED_VIDEO = {
  id: '0190c3a0-5e1d-7000-8000-000000000a01',
  title: 'The original',
  channel: {
    id: '0190c3a0-5e1d-7000-8000-000000000c01',
    handle: 'first-uploader',
    displayName: 'First Uploader',
    avatarUrl: null,
  },
  thumbnailUrl: 'https://cdn.test/original.jpg',
  status: 'READY' as const,
  sameChannel: false,
  mirrored: false,
  videoCoverage: 0.94,
  audioCoverage: 0.88,
  sourceRange: { fromSeconds: 12, toSeconds: 65 },
  matchedRange: { fromSeconds: 20, toSeconds: 73 },
};

export function screeningCase(overrides: Partial<ScreeningCase> = {}): ScreeningCase {
  sequence += 1;
  return {
    id: uuid(1),
    videoId: uuid(2),
    title: `Held video ${sequence}`,
    status: 'HELD',
    channel: null,
    outcome: 'HOLD',
    score: 0.93,
    open: true,
    reasons: [screeningFinding({ match: MATCHED_VIDEO })],
    flags: [],
    decision: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    appeal: null,
    modelVersion: null,
    thresholdVersion: 'v1',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** What the API was asked: list queries and every decision, in the order they arrived. */
interface Requests {
  queries: URLSearchParams[];
  decisions: { action: 'approve' | 'reject' | 'dismiss'; id: string; body?: unknown }[];
}

const pageOf = (pages: ScreeningCase[][], cursor: string | null) => {
  const index = cursor ? Number(cursor) : 0;
  return {
    items: pages[index] ?? [],
    nextCursor: index + 1 < pages.length ? String(index + 1) : null,
  };
};

interface ScreeningOptions {
  cases?: ScreeningCase[][];
  handlers?: HttpHandler[];
}

/** `/admin/screening` over keyset `cases` pages, with every decision recorded and answered. */
export async function renderScreening(
  url = '/admin/screening',
  { cases = [[]], handlers = [] }: ScreeningOptions = {}
) {
  const requests: Requests = { queries: [], decisions: [] };
  const record = (action: Requests['decisions'][number]['action'], id: string, body?: unknown) =>
    requests.decisions.push({ action, id, body });

  const rendered = await renderRoute(getRouter, url, {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      ...handlers,
      mockEndpoint(listScreeningCases, ({ request }) => {
        const { searchParams } = new URL(request.url);
        requests.queries.push(searchParams);
        return HttpResponse.json(pageOf(cases, searchParams.get('cursor')));
      }),
      mockEndpoint(approveHeldVideo, ({ params }) => {
        record('approve', String(params['id']));
        return HttpResponse.json({ videoId: String(params['id']), status: 'PROCESSING' as const });
      }),
      mockEndpoint(rejectHeldVideo, async ({ request, params }) => {
        record('reject', String(params['id']), await request.json());
        return HttpResponse.json({ videoId: String(params['id']), status: 'REJECTED' as const });
      }),
      mockEndpoint(dismissScreeningFlags, ({ params }) => {
        record('dismiss', String(params['id']));
        return HttpResponse.json({ videoId: String(params['id']), status: 'READY' as const });
      }),
    ],
  });
  return { ...rendered, requests };
}
