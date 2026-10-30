import {
  deleteCreatorVideo,
  listAdminVideos,
  listCommentReports,
  resolveCommentReport,
  takeDownVideo,
  updateCreatorVideo,
} from '@vp/api-contracts';
import { account, mockEndpoint, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw';

import { signInBrowser } from '#app/__tests__/providers';
import type { AdminReport } from '#app/features/admin/api/admin-reports';
import type { AdminVideo } from '#app/features/admin/api/admin-videos';
import { getRouter } from '#app/router';
import { categoriesList } from './categories.fixture';

let sequence = 0;

const uuid = (kind: number) =>
  `0190c3a0-5e1d-7000-8000-${String(kind).padStart(4, '0')}${String(sequence).padStart(8, '0')}`;

export function adminVideo(overrides: Partial<AdminVideo> = {}): AdminVideo {
  sequence += 1;
  return {
    id: uuid(1),
    ownerId: uuid(2),
    title: `Video ${sequence}`,
    visibility: 'public',
    status: 'READY',
    channel: null,
    viewsCount: 0,
    likesCount: 0,
    categoryId: null,
    version: 3,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function commentReport(overrides: Partial<AdminReport> = {}): AdminReport {
  sequence += 1;
  return {
    id: uuid(3),
    commentId: uuid(4),
    reporterId: uuid(5),
    reason: 'spam',
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    resolvedAt: null,
    resolution: null,
    comment: {
      id: uuid(4),
      videoId: uuid(1),
      authorId: uuid(6),
      content: `Buy followers now ${sequence}`,
      removed: false,
    },
    ...overrides,
  };
}

/** What the API was asked: list queries by page, and every write, in the order they arrived. */
interface Requests {
  videoQueries: URLSearchParams[];
  reportCursors: (string | null)[];
  patched: { id: string; body: unknown }[];
  takenDown: { id: string; body: unknown }[];
  deleted: string[];
  resolved: { id: string; body: unknown }[];
}

const pageOf = <Row,>(pages: Row[][], cursor: string | null) => {
  const index = cursor ? Number(cursor) : 0;
  return {
    items: pages[index] ?? [],
    nextCursor: index + 1 < pages.length ? String(index + 1) : null,
  };
};

interface ModerationOptions {
  videos?: AdminVideo[][];
  reports?: AdminReport[][];
  handlers?: HttpHandler[];
}

/** `/admin/moderation` over keyset `videos` and `reports` pages, with every write recorded and answered. */
export async function renderModeration(
  url = '/admin/moderation',
  { videos = [[]], reports = [[]], handlers = [] }: ModerationOptions = {}
) {
  const requests: Requests = {
    videoQueries: [],
    reportCursors: [],
    patched: [],
    takenDown: [],
    deleted: [],
    resolved: [],
  };
  const rendered = await renderRoute(getRouter, url, {
    handlers: [
      signInBrowser(account({ role: 'ADMIN' })),
      ...handlers,
      categoriesList([]),
      mockEndpoint(listAdminVideos, ({ request }) => {
        const { searchParams } = new URL(request.url);
        requests.videoQueries.push(searchParams);
        return HttpResponse.json(pageOf(videos, searchParams.get('cursor')));
      }),
      mockEndpoint(listCommentReports, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        requests.reportCursors.push(cursor);
        return HttpResponse.json(pageOf(reports, cursor));
      }),
      mockEndpoint(updateCreatorVideo, async ({ request, params }) => {
        requests.patched.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(video());
      }),
      mockEndpoint(takeDownVideo, async ({ request, params }) => {
        requests.takenDown.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(video());
      }),
      mockEndpoint(deleteCreatorVideo, ({ params }) => {
        requests.deleted.push(String(params['id']));
        return HttpResponse.json({ videoId: String(params['id']), status: 'DELETED' as const });
      }),
      mockEndpoint(resolveCommentReport, async ({ request, params }) => {
        requests.resolved.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(commentReport());
      }),
    ],
  });
  return { ...rendered, requests };
}
