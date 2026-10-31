import type { TaitubePlayerProps } from '#app/features/player';

export const DURATION = 200;

/** Stands for the player: its buttons are the playhead moving, a pause and the end. */
export function ProgressPlayer({ onTimeUpdate, onPause, onEnded }: TaitubePlayerProps) {
  const at = (currentTime: number) => ({ currentTime, duration: DURATION });

  return (
    <div data-testid="player">
      {[0, 4, 5, 10, 12, 14, 21, 30].map((seconds) => (
        <button key={seconds} type="button" onClick={() => onTimeUpdate?.(at(seconds))}>
          {`Play to ${seconds}`}
        </button>
      ))}
      <button type="button" onClick={() => onPause?.(at(30.7))}>
        Pause at 30
      </button>
      <button type="button" onClick={() => onEnded?.({ duration: DURATION })}>
        Finish
      </button>
    </div>
  );
}
