import { listCreatorComments } from '@vp/api-contracts';
import { creatorCommentKeys } from '@vp/queries';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, inboxComment, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { authorCommentsQueryOptions } from '../author-queries';

const AUTHOR = '0190c3a0-5e1d-7000-8000-00000000b001';

describe('apps/client/studio: authorCommentsQueryOptions', () => {
  it('asks for the latest comments of one author in any state', async () => {
    const asked: Record<string, string> = {};
    apiServer.use(
      mockEndpoint(listCreatorComments, ({ request }) => {
        Object.assign(asked, Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json({ items: [inboxComment()], nextCursor: null });
      })
    );

    const page = await createQueryClient().fetchQuery(authorCommentsQueryOptions(api, AUTHOR));

    expect(page).toEqual({ items: [inboxComment()], nextCursor: null });
    expect(asked).toEqual({ filter: 'all', authorId: AUTHOR, limit: '6' });
  });

  it('is kept under the creator comment keys, so a held comment arriving refreshes it', () => {
    expect(authorCommentsQueryOptions(api, AUTHOR).queryKey).toEqual(
      creatorCommentKeys.byAuthor(AUTHOR)
    );
    expect(creatorCommentKeys.byAuthor(AUTHOR).slice(0, 2)).toEqual(creatorCommentKeys.all);
  });
});
