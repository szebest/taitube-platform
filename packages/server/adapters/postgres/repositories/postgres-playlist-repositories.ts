import { PostgresPlaylistActivityRepository } from './postgres-playlist-activity-repository';
import { PostgresPlaylistCollaboratorRepository } from './postgres-playlist-collaborator-repository';
import { PostgresPlaylistLibraryRepository } from './postgres-playlist-library-repository';
import { PostgresPlaylistRepository } from './postgres-playlist-repository';
import { PostgresPlaylistStatsRepository } from './postgres-playlist-stats-repository';
import { PostgresSmartPlaylistRepository } from './postgres-smart-playlist-repository';
import type { PostgresDatabase } from './types';

export function createPlaylistRepositories(db: PostgresDatabase) {
  return {
    playlists: new PostgresPlaylistRepository(db),
    playlistCollaborators: new PostgresPlaylistCollaboratorRepository(db),
    playlistActivity: new PostgresPlaylistActivityRepository(db),
    smartPlaylists: new PostgresSmartPlaylistRepository(db),
    playlistLibrary: new PostgresPlaylistLibraryRepository(db),
    playlistStats: new PostgresPlaylistStatsRepository(db),
  };
}

export type PlaylistRepositories = ReturnType<typeof createPlaylistRepositories>;
