import { assertNever } from '@kit/result';
import type { PostView } from '@vp/api-contracts';
import { recordPostShareClick, useApi } from '@vp/queries';
import { PostCard } from '#app/components/posts/post-card';
import { PostPoll } from '../post-poll/post-poll';

export function PostContent({ post }: { post: PostView }) {
  const api = useApi();
  const { body } = post;
  const countShareClick = () => void recordPostShareClick(api, post.id);

  switch (body.kind) {
    case 'text':
      return <PostCard.Text text={body.text} />;
    case 'images':
      return (
        <>
          {body.caption && <PostCard.Text text={body.caption} />}
          <PostCard.Media images={body.images} />
        </>
      );
    case 'poll':
    case 'quiz':
      return <PostPoll post={post} body={body} />;
    case 'video_share':
      return (
        <>
          {body.comment && <PostCard.Text text={body.comment} />}
          <PostCard.ShareCard share={body.card} startMs={body.startMs} onOpen={countShareClick} />
        </>
      );
    case 'playlist_share':
      return (
        <>
          {body.comment && <PostCard.Text text={body.comment} />}
          <PostCard.ShareCard share={body.card} onOpen={countShareClick} />
        </>
      );
    default:
      return assertNever(body, 'post body');
  }
}
