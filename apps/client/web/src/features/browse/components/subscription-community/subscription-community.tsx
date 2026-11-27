import { PageHeader } from '@kit/components';
import { communityFeedQueryOptions, useApi, usePostViewer } from '@vp/queries';
import { PostFeed } from '#app/components/posts/post-feed';
import { useT } from '#app/lib/messages';

/** The posts of the channels the viewer subscribes to, newest first. */
export function SubscriptionCommunity() {
  const api = useApi();
  const viewer = usePostViewer();
  const { tOr } = useT();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('posts.communityTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <PostFeed
        options={communityFeedQueryOptions(api, viewer)}
        empty={tOr('posts.communityEmpty', {}, '')}
      />
    </section>
  );
}
