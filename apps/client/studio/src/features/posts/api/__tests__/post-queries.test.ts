import { QueryClient } from '@tanstack/react-query';
import { listManagedPosts } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { managedPost } from '#app/features/posts/__tests__/posts-api.fixture';
import {
  managedPostsQueryOptions,
  postKeys,
  shareablePlaylistsQueryOptions,
  shareableVideosQueryOptions,
} from '../post-queries';

const FIRST = '0190c3a0-5e1d-7000-8000-0000000fe001';
const SECOND = '0190c3a0-5e1d-7000-8000-0000000fe002';

describe('apps/client/studio: post queries', () => {
  it('keeps every channel, stage and kind of list under its own key', () => {
    const keys = [
      postKeys.list(FIRST, undefined),
      postKeys.list(FIRST, 'draft'),
      postKeys.list(SECOND, undefined),
      postKeys.stats(FIRST, 'p'),
      postKeys.videos(FIRST),
      postKeys.playlists(FIRST),
    ].map((key) => key.join('/'));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives a second identity a cache entry of its own, never the first one drafts', async () => {
    const asked: { cursor: string | null; status: string | null }[] = [];
    apiServer.use(
      mockEndpoint(listManagedPosts, ({ request }) => {
        const { searchParams } = new URL(request.url);
        asked.push({ cursor: searchParams.get('cursor'), status: searchParams.get('status') });
        const id = asked.length === 1 ? FIRST : SECOND;
        return HttpResponse.json({
          items: [managedPost({ kind: 'text', text: `Draft of ${id}` }, { id, status: 'draft' })],
          nextCursor: null,
        });
      })
    );
    const client = new QueryClient();
    const first = managedPostsQueryOptions(api, FIRST, 'draft');
    const second = managedPostsQueryOptions(api, SECOND, 'draft');

    await client.fetchInfiniteQuery(first);
    await client.fetchInfiniteQuery(second);

    expect(asked).toHaveLength(2);
    expect(asked[0]).toEqual({ cursor: null, status: 'draft' });
    expect(client.getQueryData(first.queryKey)?.pages[0]?.items[0]?.id).toBe(FIRST);
    expect(client.getQueryData(second.queryKey)?.pages[0]?.items[0]?.id).toBe(SECOND);
  });

  it('asks for every stage with no status', async () => {
    const asked: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listManagedPosts, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('status'));
        return HttpResponse.json({ items: [], nextCursor: null });
      })
    );

    await new QueryClient().fetchInfiniteQuery(managedPostsQueryOptions(api, FIRST, undefined));

    expect(asked).toEqual([null]);
  });

  it.each([
    { scenario: 'the videos a post shares', key: shareableVideosQueryOptions(api, FIRST).queryKey },
    {
      scenario: 'the playlists a post shares',
      key: shareablePlaylistsQueryOptions(api, FIRST).queryKey,
    },
  ])('keys $scenario by channel too', ({ key }) => {
    expect(key).toContain(FIRST);
  });
});
