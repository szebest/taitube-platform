import { libraryVideo, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { buildPlaylistRows, expandFoldedOrder, placeInOrder, unfoldedRows } from '../playlist-rows';

const [A, B, C] = [uuid(5000), uuid(5001), uuid(5002)];
const [EARLY, LATE] = [uuid(6000), uuid(6001)];

/** Videos at positions 1, 2 and 4, a section at 0 and another at 3. */
const buildPlaylist = () => {
  const playlist = playlistDetail(uuid(4100), [libraryVideo(1), libraryVideo(2), libraryVideo(3)]);
  return {
    ...playlist,
    items: playlist.items.map((item, index) => ({ ...item, position: [1, 2, 4][index] ?? 0 })),
    sections: [
      { id: LATE, title: 'Later', position: 3 },
      { id: EARLY, title: 'Early', position: 0 },
    ],
  };
};

const shape = (rows: ReturnType<typeof buildPlaylistRows>) =>
  rows.map((row) =>
    row.kind === 'section' ? `${row.id}:${row.count}` : `${row.id}<${row.sectionId}`
  );

describe('apps/client/web: playlist rows', () => {
  it('merges the sections into the videos by position, each counting the videos up to the next', () => {
    expect(shape(buildPlaylistRows(buildPlaylist()))).toEqual([
      `${EARLY}:2`,
      `${A}<${EARLY}`,
      `${B}<${EARLY}`,
      `${LATE}:1`,
      `${C}<${LATE}`,
    ]);
  });

  it('leaves the videos above the first section in none', () => {
    const playlist = { ...buildPlaylist(), sections: [{ id: LATE, title: 'Later', position: 3 }] };

    expect(shape(buildPlaylistRows(playlist))).toEqual([
      `${A}<null`,
      `${B}<null`,
      `${LATE}:1`,
      `${C}<${LATE}`,
    ]);
  });

  it('hides the videos of a folded section and keeps the section', () => {
    const rows = buildPlaylistRows(buildPlaylist());

    expect(unfoldedRows(rows, new Set([EARLY])).map(({ id }) => id)).toEqual([EARLY, LATE, C]);
  });

  it.each([
    { moved: 'a folded section', shown: [LATE, C, EARLY], order: [LATE, C, EARLY, A, B] },
    { moved: 'a video past it', shown: [EARLY, C, LATE], order: [EARLY, A, B, C, LATE] },
  ])('carries the hidden videos along when $moved moves', ({ shown, order }) => {
    const rows = buildPlaylistRows(buildPlaylist());

    expect(expandFoldedOrder(shown, rows, new Set([EARLY]))).toEqual(order);
  });

  it('places items and sections in the order given and drops what it leaves out', () => {
    const placed = placeInOrder(buildPlaylist(), [C, LATE, A, EARLY]);

    expect(placed.items.map(({ id, position }) => [id, position])).toEqual([
      [C, 0],
      [A, 2],
    ]);
    expect(placed.sections.map(({ id, position }) => [id, position])).toEqual([
      [LATE, 1],
      [EARLY, 3],
    ]);
  });
});
