import { useT } from '@vp/intl-react';
import { Drawer } from '@vp/ui';

import { WatchCommentThread } from '#app/features/watch/components/watch-comment-thread';

export interface ShortsCommentSheetProps {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The discussion of a Short, in a sheet over the player. */
export function ShortsCommentSheet({ videoId, open, onOpenChange }: ShortsCommentSheetProps) {
  const { tOr } = useT();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Content size="lg" aria-describedby={undefined}>
        <Drawer.Handle />
        <Drawer.Title className="tw:sr-only">{tOr('watch.discussion', {}, '')}</Drawer.Title>
        <Drawer.Body>
          <WatchCommentThread videoId={videoId} layout="sheet" />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
