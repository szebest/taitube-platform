import { useT } from '@vp/intl-react';
import { usePlayerState } from '#app/integrations/video-js/video-js-engine';

/** What is playing now, over a corner of the picture: the viewer's stats overlay default draws it. */
export function StatsOverlay() {
  const playbackRate = usePlayerState((state) => state.playbackRate);
  const activeHeight = usePlayerState((state) => state.activeHeight);

  const { tOr } = useT();

  return (
    <dl className="pointer-events-none absolute start-2 top-2 m-0 grid grid-cols-[auto_auto] gap-x-3 rounded-thumb bg-media/70 px-2 py-1 text-caption text-on-media">
      <dt>{tOr('player.quality', {}, '')}</dt>
      <dd className="m-0">
        {activeHeight
          ? tOr('videos.resolution', { height: activeHeight }, '')
          : tOr('player.autoQuality', {}, '')}
      </dd>
      <dt>{tOr('player.speed', {}, '')}</dt>
      <dd className="m-0">{tOr('player.rate', { rate: playbackRate }, '')}</dd>
    </dl>
  );
}
