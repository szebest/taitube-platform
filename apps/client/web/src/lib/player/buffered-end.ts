/** Where the buffered range holding `time` ends, in seconds; 0 where nothing around `time` is buffered. */
export function bufferedEndAt(
  buffered: readonly (readonly [number, number])[],
  time: number
): number {
  return buffered.find(([start, end]) => start <= time && time <= end)?.[1] ?? 0;
}
