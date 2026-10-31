export const EMBED_DEFAULT_WIDTH = 640;

const ASPECT_WIDTH = 16;
const ASPECT_HEIGHT = 9;

export interface EmbedSize {
  width: number;
  height: number;
}

/**
 * The player is 16:9. `maxwidth` and `maxheight` are ceilings, never targets: the largest 16:9 box
 * up to the default width that fits both.
 */
export function fitEmbedSize(limits: { maxwidth?: number; maxheight?: number }): EmbedSize {
  const { maxwidth = EMBED_DEFAULT_WIDTH, maxheight = Number.POSITIVE_INFINITY } = limits;
  const width = Math.max(
    1,
    Math.floor(Math.min(EMBED_DEFAULT_WIDTH, maxwidth, (maxheight * ASPECT_WIDTH) / ASPECT_HEIGHT))
  );
  return { width, height: Math.max(1, Math.round((width * ASPECT_HEIGHT) / ASPECT_WIDTH)) };
}
