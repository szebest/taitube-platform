import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { uuidv7 } from 'uuidv7';
import {
  PlaylistActivityService,
  PlaylistCollaborationService,
  PlaylistCoverService,
  PlaylistItemService,
  PlaylistLibraryService,
  PlaylistPortabilityService,
  PlaylistReader,
  PlaylistService,
  PlaylistSharingService,
  PlaylistStatsRecorder,
  PlaylistTransferService,
  SmartPlaylistReader,
} from '../services/index';
import { Services } from './service-tokens';

/**
 * A playlist and the people on it. Invite and share link tokens come from the share-link
 * generator; opens, plays, follows and forks go through the view buffer.
 */
export function registerPlaylistServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);
  const newId = () => uuidv7();

  return c
    .provide(
      Services.SmartPlaylistReader,
      (c) =>
        new SmartPlaylistReader({
          smart: repositories().smartPlaylists,
          cache: c.get(Adapters.Cache),
          cdn: config().cdn,
          sprite: config().sprite,
          now: Date.now,
        })
    )
    .provide(
      Services.PlaylistStatsRecorder,
      (c) => new PlaylistStatsRecorder({ viewBuffer: c.get(Adapters.ViewBuffer), now: Date.now })
    )
    .provide(
      Services.PlaylistSharingService,
      (c) =>
        new PlaylistSharingService({
          playlists: repositories().playlists,
          shareLinks: repositories().shareLinks,
          stats: repositories().playlistStats,
          newToken: c.get(Services.VideoAccessSecrets).newShareToken,
          newId,
          now: Date.now,
        })
    )
    .provide(
      Services.PlaylistReader,
      (c) =>
        new PlaylistReader({
          playlists: repositories().playlists,
          viewerProgress: c.get(Services.ViewerProgress),
          smart: c.get(Services.SmartPlaylistReader),
          sharing: c.get(Services.PlaylistSharingService),
          recorder: c.get(Services.PlaylistStatsRecorder),
          cdn: config().cdn,
          sprite: config().sprite,
        })
    )
    .provide(
      Services.PlaylistService,
      (c) =>
        new PlaylistService({
          playlists: repositories().playlists,
          seats: repositories().playlistCollaborators,
          videos: repositories().videos,
          reader: c.get(Services.PlaylistReader),
          covers: c.get(Services.PlaylistCoverService),
        })
    )
    .provide(
      Services.PlaylistCoverService,
      (c) =>
        new PlaylistCoverService({
          playlists: repositories().playlists,
          channels: repositories().channels,
          images: repositories().channelImages,
          pipeline: c.get(Services.ChannelImagePipelineService),
        })
    )
    .provide(
      Services.PlaylistLibraryService,
      (c) =>
        new PlaylistLibraryService({
          playlists: repositories().playlists,
          library: repositories().playlistLibrary,
          views: c.get(Services.PlaylistReader),
          smart: c.get(Services.SmartPlaylistReader),
          recorder: c.get(Services.PlaylistStatsRecorder),
          paginator: c.get(Services.Paginator),
          cdn: config().cdn,
          newId,
          now: Date.now,
        })
    )
    .provide(
      Services.PlaylistCollaborationService,
      (c) =>
        new PlaylistCollaborationService({
          playlists: repositories().playlists,
          collaborators: repositories().playlistCollaborators,
          channels: repositories().channels,
          newToken: c.get(Services.VideoAccessSecrets).newShareToken,
          newId,
          now: Date.now,
        })
    )
    .provide(
      Services.PlaylistActivityService,
      (c) =>
        new PlaylistActivityService({
          playlists: repositories().playlists,
          activity: repositories().playlistActivity,
          channels: repositories().channels,
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.PlaylistItemService,
      (c) =>
        new PlaylistItemService({
          playlists: repositories().playlists,
          videos: repositories().videos,
          smart: c.get(Services.SmartPlaylistReader),
          sharing: c.get(Services.PlaylistSharingService),
          paginator: c.get(Services.Paginator),
          cdn: config().cdn,
          sprite: config().sprite,
          newId,
        })
    )
    .provide(
      Services.PlaylistTransferService,
      () => new PlaylistTransferService({ playlists: repositories().playlists, newId })
    )
    .provide(
      Services.PlaylistPortabilityService,
      () =>
        new PlaylistPortabilityService({
          playlists: repositories().playlists,
          videos: repositories().videos,
          webUrl: config().webUrl,
          newId,
        })
    );
}
