import { PostgresPlaylistActivityRepository } from './postgres-playlist-activity-repository';
import { PostgresPlaylistCollaboratorRepository } from './postgres-playlist-collaborator-repository';
import { PostgresPlaylistRepository } from './postgres-playlist-repository';
import type { PostgresDatabase } from './types';

export function createPlaylistRepositories(db: PostgresDatabase) {
  return {
    playlists: new PostgresPlaylistRepository(db),
    playlistCollaborators: new PostgresPlaylistCollaboratorRepository(db),
    playlistActivity: new PostgresPlaylistActivityRepository(db),
  };
}

export type PlaylistRepositories = ReturnType<typeof createPlaylistRepositories>;
