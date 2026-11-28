import type { PlaylistView } from '@vp/api-contracts';

export type PlaylistItemView = PlaylistView['items'][number];
type PlaylistSectionView = PlaylistView['sections'][number];

/** One row of the playlist: a video under the section above it, or a section with the videos it holds. */
export type PlaylistRow =
  | { kind: 'video'; id: string; item: PlaylistItemView; sectionId: string | null }
  | { kind: 'section'; id: string; section: PlaylistSectionView; count: number };

type Placed =
  | { kind: 'video'; position: number; item: PlaylistItemView }
  | { kind: 'section'; position: number; section: PlaylistSectionView };

/** The items and the sections in one order, by position; a section counts the videos up to the next one. */
export function buildPlaylistRows({
  items,
  sections,
}: Pick<PlaylistView, 'items' | 'sections'>): PlaylistRow[] {
  const placed: Placed[] = [
    ...items.map((item): Placed => ({ kind: 'video', position: item.position, item })),
    ...sections.map((section): Placed => ({
      kind: 'section',
      position: section.position,
      section,
    })),
  ].toSorted((left, right) => left.position - right.position);

  const sectionOf = (index: number) =>
    placed.slice(0, index).findLast((entry) => entry.kind === 'section');

  return placed.map((entry, index): PlaylistRow => {
    if (entry.kind === 'section') {
      const next = placed.findIndex((later, at) => at > index && later.kind === 'section');
      const count = placed
        .slice(index + 1, next === -1 ? undefined : next)
        .filter((later) => later.kind === 'video').length;
      return { kind: 'section', id: entry.section.id, section: entry.section, count };
    }
    const section = sectionOf(index);
    return {
      kind: 'video',
      id: entry.item.id,
      item: entry.item,
      sectionId: section?.kind === 'section' ? section.section.id : null,
    };
  });
}

/** The rows a viewer sees: a folded section hides its videos and stays itself. */
export function unfoldedRows(rows: readonly PlaylistRow[], folded: ReadonlySet<string>) {
  return rows.filter(
    (row) => row.kind === 'section' || row.sectionId === null || !folded.has(row.sectionId)
  );
}

/** The whole order from the order of the rows shown: each folded section brings its hidden videos along. */
export function expandFoldedOrder(
  shownIds: readonly string[],
  rows: readonly PlaylistRow[],
  folded: ReadonlySet<string>
): string[] {
  return shownIds.flatMap((id) =>
    folded.has(id)
      ? [
          id,
          ...rows
            .filter((row) => row.kind === 'video' && row.sectionId === id)
            .map((row) => row.id),
        ]
      : [id]
  );
}

/** The playlist with its items and sections placed in the order of `ids`; anything `ids` leaves out drops. */
export function placeInOrder(playlist: PlaylistView, ids: readonly string[]): PlaylistView {
  const place = new Map(ids.map((id, position) => [id, position]));
  const placed = <T extends { id: string; position: number }>(rows: readonly T[]) =>
    rows
      .flatMap((row) => {
        const position = place.get(row.id);
        return position === undefined ? [] : [{ ...row, position }];
      })
      .toSorted((left, right) => left.position - right.position);

  return { ...playlist, items: placed(playlist.items), sections: placed(playlist.sections) };
}
