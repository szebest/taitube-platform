import {
  completeChannelImage,
  createPost,
  deletePost,
  getPostStats,
  listCreatorVideos,
  listManagedPosts,
  listMyMemberships,
  listMyPlaylists,
  type ManagedPostView,
  pinPost,
  prepareChannelImage,
  type PostStatsView,
  unpinPost,
  updatePost,
} from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import type { ErrorCode } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { creatorVideo } from '#app/__tests__/creator-video.fixture';
import {
  managedPost,
  POST_ID,
} from '#app/components/posts/post-composer/__tests__/managed-post.fixture';

export { managedPost, POST_ID };

export const TEAM_CHANNEL_ID = '0190c3a0-5e1d-7000-8000-0000000fb001';
export const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-0000000fb002';
export const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-0000000fb003';
export const STATS: PostStatsView = {
  opens: 120,
  shareClicks: 7,
  likes: 31,
  replies: 4,
  votesByOption: [],
  quizCorrectShare: null,
};

export interface PostsState {
  posts: ManagedPostView[];
  stats: PostStatsView;
  videos: ReturnType<typeof creatorVideo>[];
  role?: ChannelRole;
  /** What the next write is refused with. */
  failure?: ErrorCode;
  pinFailure?: ErrorCode;
}

const PAGE = 2;

/** The posting API over `state`, which moves with each write; what it was asked comes back as `requests`. */
export function servePosts(initial: Partial<PostsState> = {}) {
  const state: PostsState = { posts: [], stats: STATS, videos: [], ...initial };
  const requests = {
    lists: [] as { status: string | null; cursor: string | null }[],
    created: [] as unknown[],
    updated: [] as { id: string; body: unknown }[],
    deleted: [] as string[],
    pinned: [] as string[],
    unpinned: [] as string[],
    stats: [] as string[],
    uploads: [] as unknown[],
  };
  const refuse = () => state.failure && problemReply(state.failure);
  const change = (id: string, patch: Partial<ManagedPostView>) => {
    state.posts = state.posts.map((post) => (post.id === id ? { ...post, ...patch } : post));
    return state.posts.find((post) => post.id === id);
  };

  const handlers = [
    mockEndpoint(listMyMemberships, () =>
      HttpResponse.json({
        items: state.role
          ? [
              {
                channelId: TEAM_CHANNEL_ID,
                ownerId: '0190c3a0-5e1d-7000-8000-0000000fb004',
                role: state.role,
                channel: { handle: 'teamshow', displayName: 'Team Show', avatarUrl: null },
              },
            ]
          : [],
      })
    ),
    mockEndpoint(listManagedPosts, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const cursor = searchParams.get('cursor');
      requests.lists.push({ status, cursor });
      const matching = state.posts.filter((post) => status === null || post.status === status);
      const from = cursor === null ? 0 : Number(cursor);
      return HttpResponse.json({
        items: matching.slice(from, from + PAGE),
        nextCursor: from + PAGE < matching.length ? String(from + PAGE) : null,
      });
    }),
    mockEndpoint(createPost, async ({ request }) => {
      const body = (await request.json()) as {
        payload: ManagedPostView['body'];
        timing: { mode: string };
      };
      requests.created.push(body);
      const refused = refuse();
      if (refused) return refused;
      const made = managedPost(body.payload, {
        id: `0190c3a0-5e1d-7000-8000-0000000fc${String(state.posts.length).padStart(3, '0')}`,
        status: body.timing.mode === 'draft' ? 'draft' : 'published',
      });
      state.posts = [made, ...state.posts];
      return HttpResponse.json(made, { status: 201 });
    }),
    mockEndpoint(updatePost, async ({ request, params }) => {
      const body = (await request.json()) as { version: number };
      requests.updated.push({ id: String(params['id']), body });
      const refused = refuse();
      if (refused) return refused;
      return HttpResponse.json(change(String(params['id']), { isEdited: true }));
    }),
    mockEndpoint(deletePost, ({ params }) => {
      requests.deleted.push(String(params['id']));
      state.posts = state.posts.filter(({ id }) => id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(pinPost, ({ params }) => {
      requests.pinned.push(String(params['id']));
      if (state.pinFailure) return problemReply(state.pinFailure);
      return HttpResponse.json(change(String(params['id']), { pinned: true }));
    }),
    mockEndpoint(unpinPost, ({ params }) => {
      requests.unpinned.push(String(params['id']));
      return HttpResponse.json(change(String(params['id']), { pinned: false }));
    }),
    mockEndpoint(getPostStats, ({ params }) => {
      requests.stats.push(String(params['id']));
      return HttpResponse.json(state.stats);
    }),
    mockEndpoint(listCreatorVideos, () =>
      HttpResponse.json({ items: state.videos, nextCursor: null })
    ),
    mockEndpoint(listMyPlaylists, () =>
      HttpResponse.json({
        items: [
          {
            id: PLAYLIST_ID,
            title: 'Best of',
            visibility: 'public',
            isSystem: false,
            videoCount: 3,
            containsVideo: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: '0190c3a0-5e1d-7000-8000-0000000fb005',
            title: 'Private list',
            visibility: 'private',
            isSystem: false,
            videoCount: 1,
            containsVideo: false,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    ),
    mockEndpoint(prepareChannelImage, async ({ request, params }) => {
      requests.uploads.push({ kind: params['kind'], ...(await request.json()) });
      return HttpResponse.json(
        {
          uploadId: UPLOAD_ID,
          uploadUrl: 'http://localhost:9000/raw/post-image',
          headers: {},
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    mockEndpoint(completeChannelImage, () =>
      HttpResponse.json({ uploadId: UPLOAD_ID, version: 1 }, { status: 202 })
    ),
  ];

  return { state, requests, handlers };
}
