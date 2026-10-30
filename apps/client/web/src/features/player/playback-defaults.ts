import type { PlayerState } from './player-port';

/**
 * The rendition a quality default asks for: the tallest one that is no taller than the rung, or
 * `undefined` where adaptive bitrate should keep choosing.
 */
export function findDefaultRendition(
  renditions: PlayerState['renditions'],
  quality: string
): string | undefined {
  const rung = Number.parseInt(quality, 10);
  if (Number.isNaN(rung)) {
    return undefined;
  }

  return renditions
    .flatMap(({ id, height }) => (height !== undefined && height <= rung ? [{ id, height }] : []))
    .toSorted((higher, lower) => lower.height - higher.height)
    .at(0)?.id;
}
