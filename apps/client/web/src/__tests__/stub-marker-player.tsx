import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';
import type { TimelineMarkerLayerProps } from '#app/components/player/timeline-marker-layer';
import { StubPlayer } from './stub-player';

/** The stub player with the slot the control bar offers over the seek bar. */
export function StubMarkerPlayer(props: TaitubePlayerWithTelemetryProps) {
  return (
    <>
      <StubPlayer {...props} />
      <div data-testid="marker-slot">{props.markers}</div>
    </>
  );
}

/** One button per marker, named by what the layer was handed, that activates it. */
export function StubMarkerLayer({ markers, onActivate }: TimelineMarkerLayerProps) {
  return (
    <>
      {markers.map(({ id, title, atMs, replies, count }) => (
        <button key={id} type="button" onClick={() => onActivate(id)}>
          {`marker ${title} ${atMs} ${replies} ${count}`}
        </button>
      ))}
    </>
  );
}
