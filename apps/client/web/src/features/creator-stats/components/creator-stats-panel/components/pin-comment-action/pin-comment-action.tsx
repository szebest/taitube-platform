import { useInfiniteQuery } from '@tanstack/react-query';
import type { CommentView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi, useFailureToast, usePinComment } from '@vp/queries';
import { Button, Icon, Popover } from '@vp/ui';
import { useState } from 'react';
import { commentsQueryOptions } from '#app/lib/query-keys/comment-keys';

const LISTED = 5;

/** The pinned comment and the most liked ones of the thread's first page, each with the button that pins or unpins it. */
export function PinCommentAction({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const pin = usePinComment();
  const [open, setOpen] = useState(false);
  const { data } = useInfiniteQuery({
    ...commentsQueryOptions(api, videoId, 'top'),
    enabled: open,
  });
  const roots = (data?.pages[0]?.items ?? []).filter(
    ({ parentId, status }) => parentId === null && status === 'published'
  );
  const listed = [
    ...roots.filter(({ isPinned }) => isPinned),
    ...roots
      .filter(({ isPinned }) => !isPinned)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, LISTED),
  ];
  const toggle = ({ id, isPinned }: CommentView) =>
    pin.mutate(
      { commentId: id, pinned: !isPinned },
      { onError: (error) => showFailure(tOr('creatorStats.saveFailed', {}, ''), error) }
    );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="soft" size="sm">
          <Icon name="pin" />
          {tOr('creatorStats.pinComment', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="flex w-80 flex-col gap-inline">
        <h3 className="m-0 text-label text-fg-muted">{tOr('creatorStats.pinMostLiked', {}, '')}</h3>
        {listed.length === 0 && (
          <p className="m-0 text-body">{tOr('creatorStats.pinNone', {}, '')}</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-inline p-0">
          {listed.map((comment) => (
            <li key={comment.id} className="flex items-center justify-between gap-inline">
              <span className="line-clamp-2 text-body">{comment.content}</span>
              <Button
                variant={comment.isPinned ? 'solid' : 'soft'}
                size="sm"
                loading={pin.isPending && pin.variables?.commentId === comment.id}
                onClick={() => toggle(comment)}
              >
                {tOr(comment.isPinned ? 'creatorStats.unpin' : 'creatorStats.pin', {}, '')}
              </Button>
            </li>
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}
