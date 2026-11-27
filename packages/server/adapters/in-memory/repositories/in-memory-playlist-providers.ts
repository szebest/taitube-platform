import type { Container } from '@kit/composition';
import { type Clock, realClock } from './clock';
import { InMemoryPlaylistActivityRepository } from './in-memory-playlist-activity-repository';
import { InMemoryPlaylistCollaboratorRepository } from './in-memory-playlist-collaborator-repository';
import { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { Repo } from './in-memory-repo-tokens';

/** The playlists, their seats and their log, which each write of the other two appends to. */
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
    );
}

export function playlistsOf(c: Container) {
  return {
    playlists: c.get(Repo.playlists),
    playlistCollaborators: c.get(Repo.playlistCollaborators),
    playlistActivity: c.get(Repo.playlistActivity),
  };
}

export type PlaylistRepositories = ReturnType<typeof playlistsOf>;
