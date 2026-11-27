import { screen } from '@testing-library/react';
import {
  type Account,
  createThreadComment,
  createVideoThread,
  getThread,
  listThreadComments,
  listVideoThreads,
  type ThreadListView,
  type ThreadView,
} from '@vp/api-contracts';
import { comment, mockEndpoint } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';
import { thread, threadList } from './thread-fixtures';

interface ThreadsOptions {
  viewer?: Account;
  search?: string;
  list?: ThreadListView;
  detail?: ThreadView;
  replies?: ReturnType<typeof comment>[];
  /** Served ahead of the defaults, to refuse a request or answer it differently. */
  handlers?: HttpHandler[];
}

/** The watch page with a video's threads, one thread's detail and its replies served; `sent` records what the viewer posts. */
export async function renderThreads({
  viewer,
  search = '',
  list = threadList(),
  detail = thread(),
  replies = [],
  handlers: overrides = [],
}: ThreadsOptions = {}) {
  const sent = { threads: [] as unknown[], replies: [] as unknown[] };
  const handlers = [
    ...overrides,
    mockEndpoint(listVideoThreads, () => HttpResponse.json(list)),
    mockEndpoint(getThread, () => HttpResponse.json(detail)),
    mockEndpoint(listThreadComments, () =>
      HttpResponse.json({ items: replies, nextCursor: null, total: replies.length })
    ),
    mockEndpoint(createVideoThread, async ({ request }) => {
      sent.threads.push(await request.json());
      return HttpResponse.json(thread({ id: detail.id }), { status: 201 });
    }),
    mockEndpoint(createThreadComment, async ({ request }) => {
      sent.replies.push(await request.json());
      return HttpResponse.json(comment(), { status: 201 });
    }),
  ];
  const rendered = await renderWatch({ viewer, search, handlers });
  return { ...rendered, sent, tabs: () => screen.getByRole('tablist', { name: 'Discussion' }) };
}
