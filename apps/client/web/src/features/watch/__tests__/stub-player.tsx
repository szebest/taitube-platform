import { useEffect } from 'react';

import type { TaitubePlayerProps } from '#app/features/player';
import { useOfferedPlayerChannel } from '#app/features/player/player-channel';

export const PLAYHEAD = 75;

export const stubSeek = vi.fn();

/** Stands for the player: it takes the channel's seek and sits at `PLAYHEAD`, shows its start time, range and whether it was told to play and offers theater mode and the end of the video. */
export function StubPlayer({ startTime, range, control, onPlay }: TaitubePlayerProps) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.attach(stubSeek), [channel]);
  useEffect(() => channel?.publish(PLAYHEAD), [channel]);

  return (
    <div
      data-testid="player"
      data-start-time={startTime}
      data-playing={control && String(!control.paused)}
      data-range={range && `${range.startMs}-${range.endMs}`}
    >
      <button type="button" onClick={channel?.toggleTheater}>
        Theater mode
      </button>
      <button type="button" onClick={() => onPlay?.({ currentTime: PLAYHEAD, duration: 600 })}>
        Start playing
      </button>
      <button type="button" onClick={channel?.end}>
        End video
      </button>
    </div>
  );
}
