import {
  createThreadComment,
  createVideoThread,
  getThread,
  listThreadComments,
  listVideoThreads,
  pinThread,
  type ThreadListView,
  type ThreadView,
  unpinThread,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { api, apiServer, comment, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { createQueryClient } from '../create-query-client';
import {
  threadCommentsQueryOptions,
  threadKeys,
  threadQueryOptions,
  useCreateThread,
  usePinThread,
  useReplyInThread,
  videoThreadsQueryOptions,
} from '../thread-queries';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-0000000f1001';
const THREAD_ID = '0190c3a0-5e1d-7000-8000-0000000f1002';
const VIEWER = 'viewer-1:primary';

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

function thread(overrides: Partial<ThreadView> = {}): ThreadView {
  return {
    id: THREAD_ID,
    videoId: VIDEO_ID,
    anchorMs: 65_000,
    title: 'The twist',
    body: '',
    isPinned: false,
    replyCount: 2,
    status: 'published',
    author: { channelId: VIDEO_ID, handle: 'sam', displayName: 'Sam', avatarUrl: null },
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

function seed(client: ReturnType<typeof createQueryClient>) {
  const listKey = videoThreadsQueryOptions(api, VIDEO_ID, VIEWER).queryKey;
  const detailKey = threadQueryOptions(api, THREAD_ID, VIEWER).queryKey;
  const repliesKey = threadCommentsQueryOptions(api, THREAD_ID, 'top').queryKey;
  const list: ThreadListView = { items: [thread()], markers: [] };
  client.setQueryData(listKey, list);
  client.setQueryData(detailKey, thread());
  client.setQueryData(repliesKey, { pages: [], pageParams: [] });

  return {
    states: () => [listKey, detailKey, repliesKey].map((key) => client.getQueryState(key)),
  };
}

describe('@vp/queries: thread keys', () => {
  it.each([
    { name: 'a video list', key: threadKeys.list(VIDEO_ID, VIEWER), tail: [VIDEO_ID, VIEWER] },
    { name: 'a guest list', key: threadKeys.list(VIDEO_ID, null), tail: [VIDEO_ID, 'guest'] },
  ])('keeps $name under its viewer', ({ key, tail }) => {
    expect(key).toEqual(['threads', 'list', ...tail]);
  });

  it('keeps one thread under each viewer', () => {
    expect(threadKeys.detail(THREAD_ID, VIEWER)).not.toEqual(
      threadKeys.detail(THREAD_ID, 'viewer-2:primary')
    );
    expect(threadKeys.detail(THREAD_ID, null)).toEqual(['threads', 'detail', THREAD_ID, 'guest']);
  });

  it('puts the sort in the replies key', () => {
    expect(threadKeys.comments(THREAD_ID, 'top')).not.toEqual(
      threadKeys.comments(THREAD_ID, 'newest')
    );
  });
});

describe('@vp/queries: thread reads', () => {
  it('reads the threads and markers of the video', async () => {
    const list: ThreadListView = {
      items: [thread()],
      markers: [{ anchorMs: 65_000, threadId: THREAD_ID, threadIds: [THREAD_ID], count: 1 }],
    };
    apiServer.use(mockEndpoint(listVideoThreads, () => HttpResponse.json(list)));
    const client = createQueryClient();

    await expect(
      client.fetchQuery(videoThreadsQueryOptions(api, VIDEO_ID, VIEWER))
    ).resolves.toEqual(list);
  });

  it('reads one thread', async () => {
    apiServer.use(mockEndpoint(getThread, () => HttpResponse.json(thread())));
    const client = createQueryClient();

    await expect(client.fetchQuery(threadQueryOptions(api, THREAD_ID, VIEWER))).resolves.toEqual(
      thread()
    );
  });

  it('reads the replies of a thread by the sort asked', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(listThreadComments, ({ request, params }) => {
        asked.push([params.id, new URL(request.url).searchParams.get('sort')]);
        return HttpResponse.json({ items: [comment()], nextCursor: null, total: 1 });
      })
    );
    const client = createQueryClient();

    await client.fetchInfiniteQuery(threadCommentsQueryOptions(api, THREAD_ID, 'newest'));

    expect(asked).toEqual([[THREAD_ID, 'newest']]);
  });
});

describe('@vp/queries: useCreateThread', () => {
  it('starts the thread at the moment and reloads the threads of the video', async () => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(createVideoThread, async ({ request, params }) => {
        sent.push([params.id, await request.clone().json()]);
        return HttpResponse.json(thread(), { status: 201 });
      })
    );
    const client = createQueryClient();
    const read = seed(client);

    await runMutation(
      client,
      () => useCreateThread(VIDEO_ID),
      { anchorMs: 65_000, title: 'The twist', body: '' },
      WithApi
    );

    expect(sent).toEqual([[VIDEO_ID, { anchorMs: 65_000, title: 'The twist', body: '' }]]);
    expect(read.states().map((state) => state?.isInvalidated)).toEqual([true, false, false]);
  });

  it('leaves the lists alone when the thread is refused', async () => {
    apiServer.use(mockEndpoint(createVideoThread, () => problemReply(ErrorCodes.THREAD_LIMIT)));
    const client = createQueryClient();
    const read = seed(client);

    const outcome = await runMutation(
      client,
      () => useCreateThread(VIDEO_ID),
      { anchorMs: 1000, title: 'Again', body: '' },
      WithApi
    );

    expect(outcome.status).toBe('rejected');
    expect(read.states().map((state) => state?.isInvalidated)).toEqual([false, false, false]);
  });
});

describe('@vp/queries: usePinThread', () => {
  it.each([
    { pinned: true, contract: pinThread },
    { pinned: false, contract: unpinThread },
  ])('sends pinned $pinned and reloads every thread read', async ({ pinned, contract }) => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(contract, ({ params }) => {
        asked.push(String(params.id));
        return HttpResponse.json(thread({ isPinned: pinned }));
      })
    );
    const client = createQueryClient();
    const read = seed(client);

    await runMutation(client, usePinThread, { threadId: THREAD_ID, pinned }, WithApi);

    expect(asked).toEqual([THREAD_ID]);
    expect(read.states().every((state) => state?.isInvalidated)).toBe(true);
  });
});

describe('@vp/queries: useReplyInThread', () => {
  it('sends the reply to the thread and reloads its replies and count', async () => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(createThreadComment, async ({ request, params }) => {
        sent.push([params.id, await request.clone().json()]);
        return HttpResponse.json(comment(), { status: 201 });
      })
    );
    const client = createQueryClient();
    const read = seed(client);

    await runMutation(client, () => useReplyInThread(THREAD_ID), { content: 'Yes' }, WithApi);

    expect(sent).toEqual([[THREAD_ID, { content: 'Yes' }]]);
    expect(read.states().every((state) => state?.isInvalidated)).toBe(true);
  });
});
