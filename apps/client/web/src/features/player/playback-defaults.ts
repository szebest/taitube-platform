import type { PlayerCaptionTrack, PlayerState } from './player-port';

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

function findInLanguage<Track extends PlayerCaptionTrack>(
  tracks: readonly Track[],
  language: string
): Track | undefined {
  const tagged = tracks.flatMap((track) =>
    track.language === null ? [] : [{ track, tag: track.language }]
  );

  return (
    tagged.find(({ tag }) => tag.toLowerCase() === language.toLowerCase()) ??
    tagged.find(({ tag }) => primaryLanguage(tag) === primaryLanguage(language))
  )?.track;
}

/**
 * The captions a video starts with: the viewer's chosen language, then the first of the browser's
 * languages a track has, then the language the video was detected in (its generated track), then
 * the first track. Each language match takes another region of it.
 */
export function pickCaptionTrack<Track extends PlayerCaptionTrack>(
  tracks: readonly Track[],
  chosenLanguage: string | null,
  browserLanguages: readonly string[]
): Track | undefined {
  const preferred = [...(chosenLanguage === null ? [] : [chosenLanguage]), ...browserLanguages];

  for (const language of preferred) {
    const found = findInLanguage(tracks, language);
    if (found) {
      return found;
    }
  }

  return tracks.find(({ kind }) => kind === 'auto') ?? tracks.at(0);
}
