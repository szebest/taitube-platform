import { token } from '@kit/composition';
import type {
  PlaylistActivityService,
  PlaylistCollaborationService,
  PlaylistCoverService,
  PlaylistItemService,
  PlaylistLibraryService,
  PlaylistPortabilityService,
  PlaylistReader,
  PlaylistSharingService,
  PlaylistStatsRecorder,
  PlaylistTransferService,
  SmartPlaylistReader,
} from '../services/index';

export interface PlaylistServiceSet {
  playlistCollaborationService: PlaylistCollaborationService;
  playlistCoverService: PlaylistCoverService;
  playlistActivityService: PlaylistActivityService;
  playlistItemService: PlaylistItemService;
  playlistTransferService: PlaylistTransferService;
  playlistPortabilityService: PlaylistPortabilityService;
  playlistLibraryService: PlaylistLibraryService;
  playlistSharingService: PlaylistSharingService;
}

export const PlaylistServices = {
  PlaylistCollaborationService: token<PlaylistCollaborationService>('PlaylistCollaborationService'),
  PlaylistCoverService: token<PlaylistCoverService>('PlaylistCoverService'),
  PlaylistActivityService: token<PlaylistActivityService>('PlaylistActivityService'),
  PlaylistItemService: token<PlaylistItemService>('PlaylistItemService'),
  PlaylistTransferService: token<PlaylistTransferService>('PlaylistTransferService'),
  PlaylistPortabilityService: token<PlaylistPortabilityService>('PlaylistPortabilityService'),
  PlaylistLibraryService: token<PlaylistLibraryService>('PlaylistLibraryService'),
  PlaylistSharingService: token<PlaylistSharingService>('PlaylistSharingService'),
  PlaylistReader: token<PlaylistReader>('PlaylistReader'),
  PlaylistStatsRecorder: token<PlaylistStatsRecorder>('PlaylistStatsRecorder'),
  SmartPlaylistReader: token<SmartPlaylistReader>('SmartPlaylistReader'),
};
