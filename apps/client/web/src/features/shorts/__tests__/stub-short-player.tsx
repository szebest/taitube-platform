import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';

/** Stands for the player: it shows how the Shorts player asked for it to play. */
export function StubShortPlayer({
  layout,
  control,
  playbackUrl,
  onTimeUpdate,
  captionTracks,
}: TaitubePlayerWithTelemetryProps) {
  return (
    <div
      data-testid="player"
      data-layout={layout}
      data-paused={control?.paused}
      data-muted={control?.muted}
      data-speed={control?.speed}
      data-captions={control?.captions}
      data-caption-tracks={captionTracks?.length}
      data-time-update={onTimeUpdate !== undefined}
      data-src={playbackUrl}
    />
  );
}
