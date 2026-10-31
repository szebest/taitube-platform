import type { Video } from '@vp/api-contracts';

const FALLBACK_BANDWIDTH = 800_000;
const BITS_PER_KBIT = 1000;

export interface SavableRendition {
  playlistUrl: string;
  bandwidth: number;
  width?: number;
  height?: number;
}

/** The smallest finished rendition, by ladder height; the first one when the ladder is unknown. */
export function lowestRendition({ renditions, ladder = [] }: Video): SavableRendition | undefined {
  const heights = new Map(ladder.map((entry) => [entry.name, entry]));
  const smallest = renditions
    .filter((rendition) => rendition.status === 'DONE' && rendition.playlistUrl)
    .toSorted(
      (a, b) =>
        (heights.get(a.name)?.height ?? Infinity) - (heights.get(b.name)?.height ?? Infinity)
    )
    .at(0);
  if (!smallest?.playlistUrl) {
    return undefined;
  }

  const entry = heights.get(smallest.name);
  const kbps = (entry?.videoKbps ?? 0) + (entry?.audioKbps ?? 0);
  return {
    playlistUrl: smallest.playlistUrl,
    bandwidth: kbps > 0 ? kbps * BITS_PER_KBIT : FALLBACK_BANDWIDTH,
    width: entry?.width,
    height: entry?.height,
  };
}
