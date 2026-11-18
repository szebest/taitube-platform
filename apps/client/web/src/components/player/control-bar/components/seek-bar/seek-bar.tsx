import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { videoDuration } from '@vp/intl';
import type { CSSProperties } from 'react';
import {
  chapterAt,
  chapterMarkers,
} from '#app/components/player/control-bar/utils/chapter-markers';
import {
  fromClipTime,
  toClipPlayhead,
} from '#app/components/player/control-bar/utils/clip-playhead';
import { usePlayerCommands, usePlayerState } from '#app/integrations/video-js/video-js-engine';
import type { PlaybackRange, PlayerChapter } from '#app/lib/player/taitube-player-props';

export interface SeekBarProps {
  /** A clip: the bar shows only this range of the video. */
  range?: PlaybackRange;
  /** Each one after the first is marked where it starts, and the chapter the playhead is in is spoken with the time. */
  chapters?: readonly PlayerChapter[];
}

const percentOf = (part: number, whole: number) =>
  `${whole > 0 ? Math.min((part / whole) * 100, 100) : 0}%`;

export function SeekBar({ range, chapters = [] }: SeekBarProps) {
  const videoCurrentTime = usePlayerState((state) => state.currentTime);
  const videoDurationSeconds = usePlayerState((state) => state.duration);
  const bufferedEnd = usePlayerState((state) => state.bufferedEnd);
  const { currentTime, duration } = toClipPlayhead(range, {
    currentTime: videoCurrentTime,
    duration: videoDurationSeconds,
  });
  const { currentTime: buffered } = toClipPlayhead(range, {
    currentTime: bufferedEnd,
    duration: videoDurationSeconds,
  });

  const { seek } = usePlayerCommands();
  const { tOr } = useT();
  const { format } = useFormat();

  const time = unwrapOr(format(videoDuration(currentTime)), '');
  const chapter = chapterAt(chapters, videoCurrentTime);
  const markers = chapterMarkers(chapters, range, videoDurationSeconds);

  return (
    <div className="relative">
      <input
        type="range"
        aria-label={tOr('player.seek', {}, '')}
        aria-valuetext={
          chapter ? tOr('player.seekInChapter', { time, chapter: chapter.title }, time) : time
        }
        min={0}
        max={duration}
        step="any"
        value={currentTime}
        onChange={({ currentTarget }) =>
          seek(fromClipTime(range, currentTarget.valueAsNumber, videoDurationSeconds))
        }
        style={
          {
            '--played': percentOf(currentTime, duration),
            '--buffered': percentOf(buffered, duration),
          } as CSSProperties
        }
        className="media-seek block w-full cursor-pointer"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {markers.map(({ startMs, percent }) => (
          <span
            key={startMs}
            data-slot="chapter-marker"
            style={{ insetInlineStart: `${percent}%` }}
            className="absolute top-1/2 h-1 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-media"
          />
        ))}
      </span>
    </div>
  );
}
