import { useEffect } from 'react';

import type { TaitubePlayerProps } from '#app/features/player';
import { useOfferedPlayerChannel } from '#app/features/player/player-channel';

export const PLAYHEAD = 75;

export const stubSeek = vi.fn();

/** Stands for the player: it takes the channel's seek and sits at `PLAYHEAD`, shows its start time and range and offers theater mode. */
export function StubPlayer({ startTime, range }: TaitubePlayerProps) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.attach(stubSeek), [channel]);
  useEffect(() => channel?.publish(PLAYHEAD), [channel]);

  return (
    <div
      data-testid="player"
      data-start-time={startTime}
      data-range={range && `${range.startMs}-${range.endMs}`}
    >
      <button type="button" onClick={channel?.toggleTheater}>
        Theater mode
      </button>
    </div>
  );
}
