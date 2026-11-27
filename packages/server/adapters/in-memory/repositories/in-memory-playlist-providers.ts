import type { Container } from '@kit/composition';
import { type Clock, realClock } from './clock';
import { InMemoryPlaylistActivityRepository } from './in-memory-playlist-activity-repository';
import { InMemoryPlaylistCollaboratorRepository } from './in-memory-playlist-collaborator-repository';
import { InMemoryPlaylistLibraryRepository } from './in-memory-playlist-library-repository';
import { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { InMemoryPlaylistStatsRepository } from './in-memory-playlist-stats-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemorySmartPlaylistRepository } from './in-memory-smart-playlist-repository';

/**
 * The playlists, their seats and their log, which each write of the other two appends to, and what
 * reads and keeps them beside: the rules evaluator, the library and the flushed stats.
 */
export function providePlaylists(container: Container, now: Clock = realClock): Container {
  return container
    .provide(
      Repo.playlistActivity,
      (c) =>
        new InMemoryPlaylistActivityRepository({
          userEvents: c.get(Repo.userEvents),
          outbox: c.get(Repo.outbox),
          now,
        })
    )
    .provide(
      Repo.playlistCollaborators,
      (c) =>
        new InMemoryPlaylistCollaboratorRepository({
          activity: c.get(Repo.playlistActivity),
          outbox: c.get(Repo.outbox),
          ownerOf: (playlistId) => c.get(Repo.playlists).ownerOf(playlistId),
          stopAutoRemove: (playlistId) => c.get(Repo.playlists).stopAutoRemove(playlistId),
          now,
        })
    )
    .provide(
      Repo.playlists,
      (c) =>
        new InMemoryPlaylistRepository({
          channelsRepo: c.get(Repo.channels),
          videosRepo: c.get(Repo.videos),
          seats: () => c.get(Repo.playlistCollaborators),
          history: () => c.get(Repo.watchHistory),
        })
    )
    .provide(
      Repo.smartPlaylists,
      (c) =>
        new InMemorySmartPlaylistRepository({
          channelsRepo: c.get(Repo.channels),
          videosRepo: c.get(Repo.videos),
          allVideos: () => c.get(Repo.videos).getAllVideos(),
          history: () => c.get(Repo.watchHistory),
        })
    )
    .provide(
      Repo.playlistLibrary,
      (c) => new InMemoryPlaylistLibraryRepository(() => c.get(Repo.playlists))
    )
    .provide(
      Repo.playlistStats,
      (c) =>
        new InMemoryPlaylistStatsRepository({
          hasPlaylist: (playlistId) => c.get(Repo.playlists).ownerOf(playlistId) !== null,
          titleOf: (videoId) =>
            c
              .get(Repo.videos)
              .getAllVideos()
              .find((video) => video.id === videoId)?.title ?? null,
        })
    );
}

export function playlistsOf(c: Container) {
  return {
    playlists: c.get(Repo.playlists),
    playlistCollaborators: c.get(Repo.playlistCollaborators),
    playlistActivity: c.get(Repo.playlistActivity),
    smartPlaylists: c.get(Repo.smartPlaylists),
    playlistLibrary: c.get(Repo.playlistLibrary),
    playlistStats: c.get(Repo.playlistStats),
  };
}

export type PlaylistRepositories = ReturnType<typeof playlistsOf>;
