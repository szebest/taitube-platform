import type { VideoSummary } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { Dialog, Icon, useUiCopy } from '@vp/ui';
import { useState } from 'react';

import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';
import { useReaction } from '#app/features/reactions/hooks/use-reaction';
import { ShareDialogContent } from '#app/features/watch/components/share-dialog';
import { useVideoActions } from '#app/hooks/use-video-actions';

import { ShortsCommentSheet } from './shorts-comment-sheet';

type Panel = 'discussion' | 'share';

export interface ShortsFeedActionsProps {
  short: VideoSummary;
}

/** Like, Discussion, Share, and what the viewer can do with a video from a card: the actions of a Short. */
export function ShortsFeedActions({ short }: ShortsFeedActionsProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const copy = useUiCopy();
  const { reaction, change, likesCount } = useReaction(short.id);
  const { save, enqueue } = useVideoActions(short.id);
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
      <ShortsCommentSheet
        videoId={short.id}
        open={panel === 'discussion'}
        onOpenChange={closePanel}
      />
      <Dialog.Root open={panel === 'share'} onOpenChange={closePanel}>
        <ShareDialogContent videoId={short.id} startAt={0} />
      </Dialog.Root>
    </>
  );
}
