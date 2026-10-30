import { useEffect } from 'react';

import type { TaitubePlayerWithTelemetryProps } from '#app/features/player';
import { useOfferedPlayerChannel } from '#app/features/player/player-channel';

export const PLAYHEAD = 75;

export const stubSeek = vi.fn();

/** Stands for the player: it takes the channel's seek and sits at `PLAYHEAD`, and shows its start time. */
export function StubPlayer({ startTime }: TaitubePlayerWithTelemetryProps) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.attach(stubSeek), [channel]);
  useEffect(() => channel?.publish(PLAYHEAD), [channel]);

  return <div data-testid="player" data-start-time={startTime} />;
}
