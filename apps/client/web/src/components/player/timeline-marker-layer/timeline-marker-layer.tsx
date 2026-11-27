import { usePlayerCommands, usePlayerState } from '#app/integrations/video-js/video-js-engine';
import { useT } from '#app/lib/messages';
import { barPercent, barSpan } from '#app/lib/player/bar-span';
import type { PlaybackRange } from '#app/lib/player/taitube-player-props';

const MS_PER_SECOND = 1000;

export interface TimelineMarker {
  id: string;
  atMs: number;
  title: string;
  /** Replies under the thread the marker opens. */
  replies: number;
  /** How many threads the marker stands for; a badge shows from 2. */
  count: number;
}

export interface TimelineMarkerLayerProps {
  markers: readonly TimelineMarker[];
  /** A clip: markers are placed along this range of the video only. */
  range?: PlaybackRange;
  /** Runs after the player has sought to the marker. */
  onActivate: (id: string) => void;
}

/**
 * Discussion markers laid along the seek bar, placed by the same rule as the chapter marks. Each is a
 * button that names its thread on hover and focus, seeks to the moment and hands the thread to the caller.
 */
export function TimelineMarkerLayer({ markers, range, onActivate }: TimelineMarkerLayerProps) {
  const durationSeconds = usePlayerState((state) => state.duration);
  const { seek } = usePlayerCommands();
  const { tOr } = useT();
  const span = barSpan(range, durationSeconds);
  if (!span) return null;

  return (
    <span data-slot="timeline-marker-layer" className="pointer-events-none absolute inset-0">
      {markers.map((marker) => {
        const percent = barPercent(marker.atMs, span);
        if (percent === undefined) return null;
        const replies = tOr('threads.replyCount', { count: marker.replies }, '');

        return (
          <button
            key={marker.id}
            type="button"
            data-slot="timeline-marker"
            aria-label={`${marker.title}, ${replies}`}
            style={{ insetInlineStart: `${percent}%` }}
            className="group/marker pointer-events-auto absolute top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full outline-none"
            onClick={() => {
              seek(marker.atMs / MS_PER_SECOND);
              onActivate(marker.id);
            }}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-accent ring-2 ring-media group-hover/marker:scale-125 group-focus-visible/marker:scale-125 group-focus-visible/marker:ring-on-media motion-reduce:transform-none"
            />
            {marker.count > 1 && (
              <span
                data-slot="timeline-marker-count"
                aria-hidden="true"
                className="absolute -top-2 -inset-e-2 rounded-full bg-media px-1 text-body-sm text-on-media tabular-nums"
              >
                {marker.count}
              </span>
            )}
            <span
              data-slot="timeline-marker-tip"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full mb-2 hidden w-max max-w-48 rounded-control bg-media px-2 py-1 text-body-sm text-on-media group-hover/marker:block group-focus-visible/marker:block"
            >
              <span className="block truncate">{marker.title}</span>
              <span className="block">{replies}</span>
            </span>
          </button>
        );
      })}
    </span>
  );
}
