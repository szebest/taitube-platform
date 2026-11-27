import { token } from '@kit/composition';
import type {
  PlaylistActivityService,
  PlaylistCollaborationService,
  PlaylistItemService,
  PlaylistPortabilityService,
  PlaylistTransferService,
} from '../services/index';

export interface PlaylistServiceSet {
  playlistCollaborationService: PlaylistCollaborationService;
  playlistActivityService: PlaylistActivityService;
  playlistItemService: PlaylistItemService;
  playlistTransferService: PlaylistTransferService;
  playlistPortabilityService: PlaylistPortabilityService;
}

export const PlaylistServices = {
  PlaylistCollaborationService: token<PlaylistCollaborationService>('PlaylistCollaborationService'),
  PlaylistActivityService: token<PlaylistActivityService>('PlaylistActivityService'),
  PlaylistItemService: token<PlaylistItemService>('PlaylistItemService'),
  PlaylistTransferService: token<PlaylistTransferService>('PlaylistTransferService'),
  PlaylistPortabilityService: token<PlaylistPortabilityService>('PlaylistPortabilityService'),
};
