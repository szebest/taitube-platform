import { useEffect } from 'react';
import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';

/** Where the stub plays: 75 s into the recording. */
export const LIVE_PLAYHEAD = 75;

/** Stands for the player: it sits at `LIVE_PLAYHEAD`, shows what it was handed, draws its overlay, and goes fullscreen or reports a vertical picture on a click. */
export function StubLivePlayer({
  playbackUrl,
  live,
  overlay,
  onQualityChange,
}: TaitubePlayerWithTelemetryProps) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => channel?.publish(LIVE_PLAYHEAD), [channel]);

  return (
    <div data-testid="player" data-src={playbackUrl} data-live={String(Boolean(live))}>
      <button type="button" onClick={() => channel?.publishFullscreen(true)}>
        Full screen
      </button>
      <button
        type="button"
        onClick={() => onQualityChange?.({ width: 1080, height: 1920, auto: true })}
      >
        Play a vertical picture
      </button>
      <div data-testid="player-overlay">{overlay}</div>
    </div>
  );
}
