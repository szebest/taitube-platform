import {
  type CommentView,
  createPostComment,
  getCommunityFeed,
  getPost,
  likePost,
  listChannelPosts,
  listPostComments,
  type PostView,
  recordPostOpen,
  recordPostShareClick,
  unlikePost,
  votePost,
} from '@vp/api-contracts';
import type { ErrorCode } from '@vp/errors';
import { comment, mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { post } from './post-fixtures';

const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });

export interface PostsApi {
  posts?: PostView[];
  comments?: CommentView[];
  /** What a vote is answered with, in place of the post; an error code answers that problem. */
  voteResult?: PostView | ErrorCode;
  /** What the API holds once a vote reached it, whatever it answered. */
  heldAfterVote?: PostView;
  /** How many posts an answer holds; the rest come with the cursor. */
  pageSize?: number;
  /** `METHOD /path` of every request the handlers answer, in order. */
  calls?: string[];
}

function pageOf<T>(rows: T[], cursor: string | null, size: number) {
  const start = cursor === null ? 0 : Number(cursor);
  const end = start + size;
  return { items: rows.slice(start, end), nextCursor: end < rows.length ? String(end) : null };
}

/** The posts API over `posts`, which a like moves; what it was asked comes back in `calls`. */
export function postsApi({
  posts = [post()],
  comments = [],
  voteResult,
  heldAfterVote,
  pageSize = 20,
  calls = [],
}: PostsApi = {}): HttpHandler[] {
  const held = new Map(posts.map((held) => [held.id, held]));
  const find = (id: string) => held.get(id) ?? post({ id });
  const cursorOf = (request: Request) => new URL(request.url).searchParams.get('cursor');
  const log = (request: Request) =>
    calls.push(`${request.method} ${new URL(request.url).pathname}`);

  return [
    mockEndpoint(listChannelPosts, ({ request }) => {
      log(request);
      return HttpResponse.json(pageOf([...held.values()], cursorOf(request), pageSize));
    }),
    mockEndpoint(getCommunityFeed, ({ request }) => {
      log(request);
      return HttpResponse.json(pageOf([...held.values()], cursorOf(request), pageSize));
    }),
    mockEndpoint(getPost, ({ request, params }) => {
      log(request);
      return HttpResponse.json(find(String(params.id)));
    }),
    mockEndpoint(likePost, ({ request, params }) => {
      log(request);
      const liked = find(String(params.id));
      held.set(liked.id, { ...liked, likedByViewer: true, likeCount: liked.likeCount + 1 });
      return HttpResponse.json({ postId: liked.id, liked: true, likeCount: liked.likeCount + 1 });
    }),
    mockEndpoint(unlikePost, ({ request, params }) => {
      log(request);
      const liked = find(String(params.id));
      held.set(liked.id, { ...liked, likedByViewer: false, likeCount: liked.likeCount - 1 });
      return HttpResponse.json({ postId: liked.id, liked: false, likeCount: liked.likeCount - 1 });
    }),
    mockEndpoint(votePost, ({ request }) => {
      log(request);
      if (heldAfterVote) {
        held.set(heldAfterVote.id, heldAfterVote);
      }
      if (typeof voteResult === 'string') {
        return problemReply(voteResult);
      }
      return HttpResponse.json(voteResult ?? post());
    }),
    mockEndpoint(recordPostOpen, ({ request }) => {
      log(request);
      return NO_CONTENT();
    }),
    mockEndpoint(recordPostShareClick, ({ request }) => {
      log(request);
      return NO_CONTENT();
    }),
    mockEndpoint(listPostComments, ({ request }) => {
      log(request);
      return HttpResponse.json({ items: comments, nextCursor: null, total: comments.length });
    }),
    mockEndpoint(createPostComment, async ({ request, params }) => {
      log(request);
      const { content } = await request.clone().json();
      return HttpResponse.json(
        comment({ content, target: { type: 'post', id: String(params.id) }, videoId: null }),
        { status: 201 }
      );
    }),
  ];
}
