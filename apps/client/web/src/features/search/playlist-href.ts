/** The playlist page is a route of its own once the library lands; until then the link is its URL. */
export function playlistHref(playlistId: string): string {
  return `/playlist?${new URLSearchParams({ list: playlistId })}`;
}
