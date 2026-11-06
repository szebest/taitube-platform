const ENDLIST = '#EXT-X-ENDLIST';

function isUri(line: string): boolean {
  return line.trim() !== '' && !line.startsWith('#');
}

/**
 * RFC 8216 section 4.1: in a media playlist every line that is not blank and does not start with `#`
 * is a segment URI. The pipeline writes MPEG-TS segments, so there is no `#EXT-X-MAP` URI to read.
 */
export function segmentUris(playlist: string): string[] {
  return playlist
    .split(/\r?\n/)
    .filter(isUri)
    .map((line) => line.trim());
}

/** The playlist cut after its `keep`-th segment and closed, so a player ends there instead of stalling. */
export function truncatePlaylist(playlist: string, keep: number): string {
  const kept: string[] = [];
  let uris = 0;

  for (const line of playlist.split(/\r?\n/)) {
    if (uris === keep) {
      break;
    }
    if (line.trim() === ENDLIST) {
      continue;
    }
    kept.push(line);
    if (isUri(line)) {
      uris += 1;
    }
  }

  return [...kept, ENDLIST, ''].join('\n');
}
