import type { TaitubePlayerWithTelemetryProps } from '#app/features/player';

/** Stands for the player: it shows how the Shorts player asked for it to play. */
export function StubShortPlayer({ layout, control, playbackUrl }: TaitubePlayerWithTelemetryProps) {
  return (
    <div
      data-testid="player"
      data-layout={layout}
      data-paused={control?.paused}
      data-muted={control?.muted}
      data-src={playbackUrl}
    />
  );
}
