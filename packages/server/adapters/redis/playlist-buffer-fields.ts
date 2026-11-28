import type { PlaylistBufferEvent } from '@vp/core/ports';
import {
  NO_PLAYLIST_COUNTS,
  PLAYLIST_MEASURES,
  type PlaylistCount,
  type PlaylistMeasure,
  type ViewDate,
  mergePlaylistCounts,
} from '@vp/domain';
import { SEPARATOR } from './view-buffer-fields';

const PLAYLIST_PREFIX = 'pl:';

/**
 * Keyed by the playlist where the others key by the video, so no video parser reads it; a play
 * names its video in the tag, every other measure leaves the tag bare.
 */
export function playlistField(
  playlistId: string,
  viewDate: ViewDate,
  measure: PlaylistMeasure,
  videoId: string | null
): string {
  return [playlistId, viewDate, measure, `${PLAYLIST_PREFIX}${videoId ?? ''}`].join(SEPARATOR);
}

/** A play names its video in the field; every other event leaves the tag bare. */
export function playlistEventField(event: PlaylistBufferEvent): string {
  const videoId = event.measure === 'plays' ? event.videoId : null;
  return playlistField(event.playlistId, event.viewDate, event.measure, videoId);
}

function isPlaylistMeasure(value: string): value is PlaylistMeasure {
  return PLAYLIST_MEASURES.some((measure) => measure === value);
}

/** Reads the playlist fields of a drained views hash, one count per playlist, video and day. */
export function playlistsFromBuffer(hash: Readonly<Record<string, string>>): PlaylistCount[] {
  const counts = Object.entries(hash).flatMap(([field, raw]): PlaylistCount[] => {
    const [playlistId, viewDate, measure, tag, ...rest] = field.split(SEPARATOR);
    const amount = Number.parseInt(raw, 10);
    if (!(playlistId && viewDate && measure && tag?.startsWith(PLAYLIST_PREFIX))) return [];
    if (rest.length > 0 || !isPlaylistMeasure(measure) || Number.isNaN(amount) || amount <= 0) {
      return [];
    }
    const videoId = tag.slice(PLAYLIST_PREFIX.length);
    return [
      {
        ...NO_PLAYLIST_COUNTS,
        playlistId,
        videoId: measure === 'plays' && videoId !== '' ? videoId : null,
        viewDate,
        [measure]: amount,
      },
    ];
  });
  return mergePlaylistCounts(counts);
}
