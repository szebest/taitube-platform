import type { Video } from '@vp/api-contracts';
import { CLIP_MIN_MS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useState } from 'react';

import { EngagementBar } from '#app/components/watch/engagement-bar';
import { usePlayerSeek } from '#app/features/player';

import { LazyClipDialog } from './clip-dialog.lazy';

export interface ClipActionProps {
  video: Video;
  /** Called when the viewer is signed out: the action asks for sign-in and opens nothing. */
  onSignIn: () => void;
}

/** The Clip action of a video's engagement bar, and the dialog it opens; absent for a video that cannot be clipped. */
export function ClipAction({ video, onSignIn }: ClipActionProps) {
  const { currentTime } = usePlayerSeek();
  const { tOr } = useT();
  const canClip = useCan('create', 'Clip');
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [startAt, setStartAt] = useState(0);

  const { durationMs } = video;
  const clippable =
    video.visibility === 'public' && durationMs !== undefined && durationMs >= CLIP_MIN_MS;
  if (!clippable) {
    return null;
  }

  const openDialog = () => {
    if (!canClip) {
      onSignIn();
      return;
    }

    setStartAt(Math.floor(currentTime()));
    setOpen(true);
    setEverOpened(true);
  };

  return (
    <>
      <EngagementBar.Action icon="clip" onClick={openDialog}>
        {tOr('clips.clip', {}, '')}
      </EngagementBar.Action>
      {everOpened && (
        <LazyClipDialog
          video={{ ...video, durationMs }}
          startAt={startAt}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
