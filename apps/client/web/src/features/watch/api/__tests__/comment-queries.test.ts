import { listCommentReplies, listVideoComments } from '@vp/api-contracts';
import { createQueryClient, KEYSET_PAGE_SIZE } from '@vp/queries';
import { api, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { COMMENT_ID, comment } from '#app/features/watch/__tests__/comment-fixtures';
import { commentKeys, commentsQueryOptions, repliesQueryOptions } from '../comment-queries';

describe('apps/client/web: comment queries', () => {
  it('reads the comments of a video in the chosen order, a page at a time', async () => {
    const asked: URL[] = [];
    apiServer.use(
      mockEndpoint(listVideoComments, ({ request }) => {
        asked.push(new URL(request.url));
        return HttpResponse.json({ items: [comment()], nextCursor: 'next', total: 2 });
      })
    );

    const client = createQueryClient();
    const options = commentsQueryOptions(api, VIDEO_ID, 'newest');
    await client.fetchInfiniteQuery(options);

    expect(asked[0]?.pathname).toBe(`/v1/videos/${VIDEO_ID}/comments`);
    expect(Object.fromEntries(asked[0]?.searchParams ?? [])).toEqual({
      sort: 'newest',
      limit: String(KEYSET_PAGE_SIZE),
    });
    expect(
      options.getNextPageParam({ items: [], nextCursor: 'next', total: 2 }, [], undefined, [])
    ).toBe('next');
  });

  it('reads the replies of one comment', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(listCommentReplies, ({ params }) => {
        asked.push(params.id);
        return HttpResponse.json({ items: [], nextCursor: null });
      })
    );

    await createQueryClient().fetchInfiniteQuery(repliesQueryOptions(api, COMMENT_ID));

    expect(asked).toEqual([COMMENT_ID]);
  });

  it.each([
    { query: 'the list', queryKey: commentsQueryOptions(api, VIDEO_ID, 'top').queryKey },
    { query: 'the replies', queryKey: repliesQueryOptions(api, COMMENT_ID).queryKey },
  ])('files $query under the comments key', ({ queryKey }) => {
    expect(queryKey.slice(0, commentKeys.all.length)).toEqual([...commentKeys.all]);
  });
});
