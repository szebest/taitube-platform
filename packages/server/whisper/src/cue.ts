/** A cue on the media timeline, before it is numbered into a track. */
export interface TimedCue {
  startMs: number;
  endMs: number;
  text: string;
}
