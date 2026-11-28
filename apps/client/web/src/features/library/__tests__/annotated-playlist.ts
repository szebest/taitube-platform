import type { PlaylistView } from '@vp/api-contracts';
import { channel } from '@vp/web-testing';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { LIST, VIDEOS } from './render-playlist';

export const MORNING = uuid(6000);
export const NIGHT = uuid(6001);

const { id, handle, displayName, avatarUrl } = channel();

/** Who added an item: a user with the shared fixture channel as their avatar. */
export const adder = (userId: string) => ({
  userId,
  channel: { id, handle, displayName, avatarUrl },
});

/**
 * `VIDEOS` under two sections, Morning over Tram ride and Old film and Night over Night bus; Tram
 * ride carries a note and Old film a segment, with `overrides` on the playlist.
 */
export function annotatedPlaylist(overrides: Partial<PlaylistView> = {}): PlaylistView {
  const playlist = playlistDetail(LIST, VIDEOS, overrides);
  const annotations = [
    { position: 1, note: 'Watch with the sound off', startMs: null, endMs: null },
    { position: 2, note: null, startMs: 30_000, endMs: 105_000 },
    { position: 4, note: null, startMs: null, endMs: null },
  ];
  return {
    ...playlist,
    items: playlist.items.map((item, index) => ({ ...item, ...annotations[index] })),
    sections: [
      { id: MORNING, title: 'Morning', position: 0 },
      { id: NIGHT, title: 'Night', position: 3 },
    ],
    ...overrides,
  };
}
