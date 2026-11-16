import { isErr } from '@vp/result';
import { AnySchema, IdSchema, OwnedPlaylistsSchema, PlaylistSchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

export const playlists: Scenario = {
  name: 'playlists',
  essential: false,
  needsReady: true,
  requires: [
    'GET /v1/me/playlists',
    'POST /v1/playlists',
    'GET /v1/playlists/{id}',
    'POST /v1/playlists/{id}/items',
  ],
  async run({ world, api, state }) {
    const tally = createTally();
    for (const spec of world.playlists) {
      const owner = userById(world, spec.ownerId);
      if (!owner) continue;
      const actor = actorOf(owner);
      const owned = await api.send(
        { actor, method: 'GET', path: '/v1/me/playlists' },
        OwnedPlaylistsSchema
      );
      if (isErr(owned)) {
        tally.fail(owned.error);
        continue;
      }

      let playlistId = owned.value.items.find(
        (item) => !item.isSystem && item.title === spec.title
      )?.id;
      if (playlistId) tally.existing();
      else {
        const created = await api.send(
          {
            actor,
            method: 'POST',
            path: '/v1/playlists',
            json: { title: spec.title, description: spec.description, visibility: spec.visibility },
          },
          IdSchema
        );
        if (isErr(created)) {
          tally.fail(created.error);
          continue;
        }
        playlistId = created.value.id;
        tally.created();
      }

      const detail = await api.send(
        { actor, method: 'GET', path: `/v1/playlists/${playlistId}` },
        PlaylistSchema
      );
      if (isErr(detail)) {
        tally.fail(detail.error);
        continue;
      }
      const inside = new Set(detail.value.items.map((item) => item.videoId));
      for (const key of spec.videoKeys) {
        const video = state.videos.get(key);
        if (!video || video.status !== 'READY' || inside.has(video.id)) continue;
        const added = await api.send(
          {
            actor,
            method: 'POST',
            path: `/v1/playlists/${playlistId}/items`,
            json: { videoId: video.id },
          },
          AnySchema
        );
        if (isErr(added)) tally.fail(added.error);
        else tally.created();
      }
    }
    return tally.outcome('playlists and items');
  },
};
