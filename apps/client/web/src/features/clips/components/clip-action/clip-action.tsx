import type { Video } from '@vp/api-contracts';
import { CLIP_MIN_MS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useRef, useState } from 'react';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { LazyClipDialog } from '../clip-dialog/clip-dialog.lazy';

export interface ClipActionProps {
  video: Video;
}

/** The Clip action of a video's engagement bar, and the dialog it opens; absent for a video that cannot be clipped. */
export function ClipAction({ video }: ClipActionProps) {
  const { currentTime } = usePlayerSeek();
  const { tOr } = useT();
  const { run } = useRequireAccount('clip');
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const actionRef = useRef<HTMLButtonElement>(null);

  const { durationMs } = video;
  const clippable =
    video.visibility === 'public' && durationMs !== undefined && durationMs >= CLIP_MIN_MS;
  if (!clippable) {
    return null;
  }

  const openDialog = () => {
    run(() => {
      setStartAt(Math.floor(currentTime()));
      setOpen(true);
      setEverOpened(true);
    });
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    actionRef.current?.focus();
  };

  return (
    <>
      <EngagementBar.Action ref={actionRef} icon="clip" onClick={openDialog}>
        {tOr('clips.clip', {}, '')}
      </EngagementBar.Action>
      {everOpened && (
        <LazyClipDialog
          video={{ ...video, durationMs }}
          startAt={startAt}
          open={open}
          onOpenChange={setOpen}
          onCloseAutoFocus={restoreFocus}
        />
      )}
    </>
  );
}
