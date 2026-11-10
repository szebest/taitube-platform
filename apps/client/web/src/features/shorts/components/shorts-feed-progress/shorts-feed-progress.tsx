import { useT } from '@vp/intl-react';
import { usePlayerSeek, usePlayerTime } from '#app/components/player/taitube-player';
import { ShortsPlayerFrame } from '#app/components/shorts/shorts-player-frame';

const MS_PER_SECOND = 1000;

/** The seek bar of the Short on screen; it alone re-renders as the playhead moves. */
export function ShortsFeedProgress({ durationMs }: { durationMs: number }) {
  const { tOr } = useT();
  const { seek } = usePlayerSeek();
  const seconds = usePlayerTime((time) => time);
  const duration = durationMs / MS_PER_SECOND;

  return (
    <ShortsPlayerFrame.Progress
      value={duration > 0 ? seconds / duration : 0}
      label={tOr('player.seek', {}, '')}
      onSeek={(fraction) => seek(fraction * duration)}
    />
  );
}
