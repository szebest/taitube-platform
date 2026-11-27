import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { uuidv7 } from 'uuidv7';
import {
  PlaylistActivityService,
  PlaylistCollaborationService,
  PlaylistItemService,
  PlaylistPortabilityService,
  PlaylistService,
  PlaylistTransferService,
} from '../services/index';
import { Services } from './service-tokens';

/** A playlist and the people on it. Invite tokens come from the share-link generator. */
export function registerPlaylistServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);
  const newId = () => uuidv7();

  return c
    .provide(
      Services.PlaylistService,
      (c) =>
        new PlaylistService({
          playlists: repositories().playlists,
          videos: repositories().videos,
          viewerProgress: c.get(Services.ViewerProgress),
          cdn: config().cdn,
          sprite: config().sprite,
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
