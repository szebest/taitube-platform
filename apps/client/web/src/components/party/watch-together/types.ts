/** What a room is made from: nothing yet, one video (optionally from a moment), a playlist, or an ordered list of videos. */
export type WatchTogetherSource =
  | { kind: 'empty' }
  | { kind: 'video'; videoId: string; startMs?: number }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'queue'; videoIds: string[]; startIndex?: number };
