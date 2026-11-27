import { EmptyLibraryIllustration, EmptyState } from '@kit/components';
import { Skeleton } from '@kit/ui';
import {
  type InfiniteData,
  type QueryKey,
  type UseSuspenseInfiniteQueryOptions,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import type { PostPageView } from '@vp/api-contracts';
import { PagedFooter } from '#app/components/feed/paged-footer';
import { PostItem } from '#app/components/posts/post-item';

export type PostFeedOptions<TKey extends QueryKey> = UseSuspenseInfiniteQueryOptions<
  PostPageView,
  Error,
  InfiniteData<PostPageView>,
  TKey,
  string | undefined
>;

export interface PostFeedProps<TKey extends QueryKey> {
  options: PostFeedOptions<TKey>;
  /** Said when there is no post at all. */
  empty: string;
}

/** A column of posts, pinned first as the API orders them, loading more as the viewer nears the end. */
export function PostFeed<TKey extends QueryKey>({ options, empty }: PostFeedProps<TKey>) {
  const { data, hasNextPage, isFetching, isError, fetchNextPage } =
    useSuspenseInfiniteQuery(options);
  const posts = data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-stack">
      {posts.length === 0 && !hasNextPage ? (
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{empty}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <ul className="m-0 flex max-w-reading-max list-none flex-col gap-stack p-0">
          {posts.map((post) => (
            <li key={post.id}>
              <PostItem post={post} />
            </li>
          ))}
        </ul>
      )}
      <PagedFooter
        hasMore={hasNextPage}
        isFetching={isFetching}
        isError={isError}
        onLoadMore={() => fetchNextPage({ cancelRefetch: false })}
      />
    </div>
  );
}

const SKELETON_ROWS = ['first', 'second', 'third'];

export function PostFeedSkeleton() {
  return (
    <div aria-hidden="true" className="flex max-w-reading-max flex-col gap-stack">
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-40 w-full rounded-card" />
      ))}
    </div>
  );
}
