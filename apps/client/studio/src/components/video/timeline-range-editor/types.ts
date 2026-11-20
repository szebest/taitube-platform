export interface TimelineRange {
  startMs: number;
  endMs: number;
}

/** A point on the timeline, drawn as a tick over the frames; `label` is what the tick stands for in words. */
export interface TimelineMarker {
  id: string | number;
  ms: number;
  label: string;
  /** The marker the editor is working on. */
  active?: boolean;
}

/** Two thumbs for a range held between `minSpanMs` and `maxSpanMs` long. */
export interface RangeControl {
  mode: 'range';
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
  minSpanMs: number;
  maxSpanMs: number;
  startLabel: string;
  endLabel: string;
}

/** One thumb for a position, such as the playhead a chapter takes its time from. */
export interface PositionControl {
  mode: 'position';
  positionMs: number;
  onPositionChange: (positionMs: number) => void;
  label: string;
}

export type TimelineControl = RangeControl | PositionControl;
