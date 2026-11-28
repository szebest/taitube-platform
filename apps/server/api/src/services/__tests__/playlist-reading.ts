import { randomBytes, randomUUID } from 'node:crypto';
import {
  InMemoryCacheClient,
  type InMemoryRepositories,
  InMemoryViewBuffer,
} from '@vp/adapters/in-memory';
import { PlaylistReader } from '../playlist-reader';
import { PlaylistSharingService } from '../playlist-sharing-service';
import { PlaylistStatsRecorder } from '../playlist-stats-recorder';
import { SmartPlaylistReader } from '../smart-playlist-reader';
import { ViewerProgress } from '../viewer-progress';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

/** The read side of playlists over in-memory repositories, with a buffer and a cache of its own. */
export function playlistReading(repositories: InMemoryRepositories, now: () => number = Date.now) {
  const viewBuffer = new InMemoryViewBuffer();
  const cache = new InMemoryCacheClient();
  const smart = new SmartPlaylistReader({
    smart: repositories.smartPlaylists,
    cache,
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
    now,
  });
  const recorder = new PlaylistStatsRecorder({ viewBuffer, now });
  const sharing = new PlaylistSharingService({
    playlists: repositories.playlists,
    shareLinks: repositories.shareLinks,
    stats: repositories.playlistStats,
    newToken: () => randomBytes(16).toString('base64url'),
    newId: randomUUID,
    now,
  });
  const reader = new PlaylistReader({
    playlists: repositories.playlists,
    viewerProgress: new ViewerProgress(repositories.watchHistory),
    smart,
    sharing,
    recorder,
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
  });
  return { viewBuffer, cache, smart, recorder, sharing, reader };
}
