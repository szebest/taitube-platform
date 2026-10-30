const CACHE_VERSION = 'v1';
const PREFIX = 'taitube';

export const CACHE_NAMES = {
  assets: `${PREFIX}-assets-${CACHE_VERSION}`,
  media: `${PREFIX}-media-${CACHE_VERSION}`,
  playlists: `${PREFIX}-playlists-${CACHE_VERSION}`,
  api: `${PREFIX}-api-${CACHE_VERSION}`,
} as const;

const CURRENT: ReadonlySet<string> = new Set(Object.values(CACHE_NAMES));

/** A cache this app made under an earlier version's name; the workbox precache cleans up after itself. */
export function isStaleCache(name: string): boolean {
  return name.startsWith(`${PREFIX}-`) && !CURRENT.has(name);
}
