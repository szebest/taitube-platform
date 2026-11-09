import type { VideoSummary } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Dialog, Icon, useUiCopy } from '@vp/ui';
import { type ReactNode, useState } from 'react';
import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';
import { ShareDialogContent } from '#app/components/watch/share-dialog';
import { useReaction } from '#app/hooks/use-reaction';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { ShortsCommentSheet } from '../shorts-comment-sheet/shorts-comment-sheet';

type Panel = 'discussion' | 'share';

export interface ShortsFeedActionsProps {
  short: VideoSummary;
  /** The discussion of a Short, which a route composes in. */
  renderComments: (videoId: string) => ReactNode;
}

/** Like, Discussion, Share, and what the viewer can do with a video from a card: the actions of a Short. */
export function ShortsFeedActions({ short, renderComments }: ShortsFeedActionsProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const copy = useUiCopy();
  const { reaction, change, likesCount } = useReaction(short.id);
  const { save, enqueue } = useVideoActions(short);
  const [panel, setPanel] = useState<Panel>();

  const liked = reaction === 'LIKE';
  const likes = unwrapOr(format({ type: 'count', value: likesCount ?? short.likesCount ?? 0 }), '');
  const closePanel = (open: boolean) => {
    if (!open) {
      setPanel(undefined);
    }
  };

  return (
    <>
      <ShortsPlayerFrame.Actions>
        <ShortsPlayerFrame.Action
          icon={<Icon name="like" />}
          count={likes}
          pressed={liked}
          onSelect={() => change(liked ? null : 'LIKE')}
        >
          {copy.like}
        </ShortsPlayerFrame.Action>
        <ShortsPlayerFrame.Action
          icon={<Icon name="chat" />}
          onSelect={() => setPanel('discussion')}
        >
          {tOr('watch.discussion', {}, '')}
        </ShortsPlayerFrame.Action>
        <ShortsPlayerFrame.Action icon={<Icon name="share" />} onSelect={() => setPanel('share')}>
          {tOr('watch.share', {}, '')}
        </ShortsPlayerFrame.Action>
        {enqueue && (
          <ShortsPlayerFrame.Action icon={<Icon name="queue-add" />} onSelect={enqueue}>
            {copy.queue}
          </ShortsPlayerFrame.Action>
        )}
        {save && (
          <ShortsPlayerFrame.Action icon={<Icon name="save" />} onSelect={save}>
            {copy.save}
          </ShortsPlayerFrame.Action>
        )}
      </ShortsPlayerFrame.Actions>
      <ShortsCommentSheet open={panel === 'discussion'} onOpenChange={closePanel}>
        {renderComments(short.id)}
      </ShortsCommentSheet>
      <Dialog.Root open={panel === 'share'} onOpenChange={closePanel}>
        <ShareDialogContent videoId={short.id} startAt={0} />
      </Dialog.Root>
    </>
  );
}
