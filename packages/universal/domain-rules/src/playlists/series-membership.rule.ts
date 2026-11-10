import type { Playlist, Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type SeriesVideoNotOwned, seriesVideoNotOwned } from './failures';

/** A series is made only of its owner's own videos; a plain playlist takes anyone's public ones. */
export function decideSeriesMembership(
  playlist: Pick<Playlist, 'id' | 'kind' | 'ownerId'>,
  video: Pick<Video, 'id' | 'ownerId'>
): Result<string, SeriesVideoNotOwned> {
  return playlist.kind === 'series' && video.ownerId !== playlist.ownerId
    ? err(seriesVideoNotOwned(playlist.id, video.id))
    : ok(video.id);
}
