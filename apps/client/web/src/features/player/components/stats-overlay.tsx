import { useT } from '@vp/intl-react';

import { usePlayerState } from '../engine/video-js-engine';

/** What is playing now, over a corner of the picture: the viewer's stats overlay default draws it. */
export function StatsOverlay() {
  const playbackRate = usePlayerState((state) => state.playbackRate);
  const activeHeight = usePlayerState((state) => state.activeHeight);

  const { tOr } = useT();

  return (
    <dl className="tw:pointer-events-none tw:absolute tw:start-2 tw:top-2 tw:m-0 tw:grid tw:grid-cols-[auto_auto] tw:gap-x-3 tw:rounded-thumb tw:bg-scrim tw:px-2 tw:py-1 tw:text-xs tw:text-fg">
      <dt>{tOr('player.quality', {}, '')}</dt>
      <dd className="tw:m-0">
        {activeHeight
          ? tOr('videos.resolution', { height: activeHeight }, '')
          : tOr('player.autoQuality', {}, '')}
      </dd>
      <dt>{tOr('player.speed', {}, '')}</dt>
      <dd className="tw:m-0">{tOr('player.rate', { rate: playbackRate }, '')}</dd>
    </dl>
  );
}
