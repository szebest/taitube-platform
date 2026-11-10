import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';

/** Stands for the player: it shows what it was handed. The overlay is the specs' of `PartySyncOverlay`. */
export function StubPartyPlayer({
  playbackUrl,
  controls,
}: Pick<TaitubePlayerWithTelemetryProps, 'playbackUrl' | 'controls'>) {
  return <div data-testid="player" data-src={playbackUrl} data-controls={String(controls)} />;
}
