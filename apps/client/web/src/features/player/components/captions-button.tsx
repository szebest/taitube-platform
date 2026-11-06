import { useT } from '@vp/intl-react';
import { IconButton } from '@vp/ui';
import { Captions } from 'lucide-react';
import { usePlayerCommands, usePlayerState } from '../engine/video-js-engine';

/** Turns captions on and off; a video without a ready track has none to offer. */
export function CaptionsButton() {
  const hasTracks = usePlayerState((state) => state.captionTracks.length > 0);
  const enabled = usePlayerState((state) => state.captionsEnabled);

  const { toggleCaptions } = usePlayerCommands();
  const { tOr } = useT();

  if (!hasTracks) {
    return null;
  }

  return (
    <IconButton
      aria-label={tOr('player.captions', {}, '')}
      aria-keyshortcuts="c"
      aria-pressed={enabled}
      onClick={toggleCaptions}
    >
      <Captions aria-hidden="true" />
    </IconButton>
  );
}
