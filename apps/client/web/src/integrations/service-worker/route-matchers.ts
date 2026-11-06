const ART = /\/videos\/[^/]+\/thumbs\/(poster\.jpg|sprite\.jpg|sprite\.vtt)$/;
const PLAYLIST = /\.m3u8$/;
const SEGMENT = /\.(ts|m4s)$/;
const VIDEO_DETAIL = /^\/api\/v1\/videos\/[^/]+$/;
const PUBLIC_API_PATHS: ReadonlySet<string> = new Set(['/api/v1/feed', '/api/v1/categories']);
const STATIC_DESTINATIONS: ReadonlySet<RequestDestination> = new Set(['script', 'style', 'font']);

/** A video's poster or storyboard sprite sheet and its cue file, on the media origin. */
export function isVideoArt({ pathname }: URL): boolean {
  return ART.test(pathname);
}

/** An HLS playlist; the segments it lists are never matched, so they stay out of every cache. */
export function isPlaylist({ pathname }: URL): boolean {
  return PLAYLIST.test(pathname);
}

/**
 * The two public listings the browser reads through this origin's API proxy. The match is exact, so
 * `/api/v1/feed/subscriptions` and everything under `/me` are never cached.
 */
export function isPublicApi(url: URL, origin: string): boolean {
  return url.origin === origin && PUBLIC_API_PATHS.has(url.pathname);
}

/** A script, stylesheet or font of this origin that the precache manifest does not list. */
export function isStaticAsset(url: URL, destination: RequestDestination, origin: string): boolean {
  return url.origin === origin && STATIC_DESTINATIONS.has(destination);
}

/** A page load that is not a call to the API proxy. */
export function isPageNavigation(url: URL, mode: RequestMode): boolean {
  return mode === 'navigate' && !url.pathname.startsWith('/api/');
}

const VIDEO_SUBRESOURCE = /^\/api\/v1\/videos\/[^/]+\/(reactions|comments)$/;

/** A call to a video's `/reactions` or `/comments` endpoint through this origin's API proxy. */
export function isVideoSubresource(
  url: URL,
  origin: string,
  resource: 'reactions' | 'comments'
): boolean {
  return url.origin === origin && VIDEO_SUBRESOURCE.exec(url.pathname)?.[1] === resource;
}

/** An HLS media segment; only the saved-videos route reads it, so no runtime cache holds one. */
export function isSegment({ pathname }: URL): boolean {
  return SEGMENT.test(pathname);
}

/** A video's detail call through this origin's API proxy, which a saved video keeps for the watch page. */
export function isVideoDetail(url: URL, origin: string): boolean {
  return url.origin === origin && VIDEO_DETAIL.test(url.pathname);
}
