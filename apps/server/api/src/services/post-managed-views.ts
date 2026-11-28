import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, isErr, ok } from '@kit/result';
import type { ManagedPostView } from '@vp/api-contracts';
import type { ChannelPost } from '@vp/domain';
import type { PostViewer } from './post-poll-views';
import { type PostViewDeps, toPostViews } from './post-views';

/** What the team sees of its own posts: the public view of each, with where it is in the pipeline. */
export async function toManagedPostViews(
  deps: PostViewDeps,
  posts: readonly ChannelPost[],
  viewer: PostViewer
): Promise<Result<ManagedPostView[], DatabaseUnavailable>> {
  const views = await toPostViews(
    deps,
    posts.map((post) => ({ post, likedByViewer: false })),
    viewer
  );
  if (isErr(views)) return views;
  const byId = new Map(views.value.map((view) => [view.id, view]));
  return ok(
    posts.flatMap((post) => {
      const view = byId.get(post.id);
      if (!view) return [];
      return [
        {
          ...view,
          status: post.status,
          publishAt: post.publishAt?.toISOString() ?? null,
          publishedAt: post.publishedAt?.toISOString() ?? null,
          createdAt: post.createdAt.toISOString(),
        },
      ];
    })
  );
}
