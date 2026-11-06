export const EMBED_PATH_PREFIX = '/embed/';

/** A path the root route renders with no app shell, so a third-party page can frame it alone. */
export function isEmbedPath(pathname: string): boolean {
  return pathname.startsWith(EMBED_PATH_PREFIX);
}
