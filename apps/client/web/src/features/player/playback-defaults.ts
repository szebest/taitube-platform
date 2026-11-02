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

const primaryLanguage = (tag: string) => tag.toLowerCase().split('-')[0];

/**
 * The captions a default asks for: the track in the chosen language, any region of it, or the
 * first captions track where no language is chosen.
 */
export function findDefaultCaptionTrack<Track extends { kind: string; language: string }>(
  tracks: readonly Track[],
  language: string | null
): Track | undefined {
  const captions = tracks.filter(({ kind }) => kind === 'captions' || kind === 'subtitles');
  if (language === null) {
    return captions.at(0);
  }

  return (
    captions.find((candidate) => candidate.language.toLowerCase() === language.toLowerCase()) ??
    captions.find((candidate) => primaryLanguage(candidate.language) === primaryLanguage(language))
  );
}
