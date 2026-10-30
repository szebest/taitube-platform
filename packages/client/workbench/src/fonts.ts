/** How Chromium spells the Latin-1 block, the first range of every Latin subset, once it parses a face. */
const LATIN_RANGE = 'U+0-FF,';

export function latinFaces<Face extends Pick<FontFace, 'unicodeRange'>>(faces: Iterable<Face>) {
  return [...faces].filter((face) => face.unicodeRange.startsWith(LATIN_RANGE));
}

/**
 * `ch` and `lh` lengths resolve against the font at the first layout and Chromium can keep the
 * fallback's value after the web font arrives, so a story renders only once its fonts are in.
 */
export async function loadLatinFonts(faces: Iterable<FontFace> = document.fonts) {
  await Promise.all(latinFaces(faces).map((face) => face.load()));
}
