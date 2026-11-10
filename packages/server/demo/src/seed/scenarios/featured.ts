import { isErr } from '@vp/result';
import { z } from 'zod';
import { AnySchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

const ShelfSchema = z.object({ items: z.array(z.object({ id: z.string() })) });
const SpotlightSettingsSchema = z.object({ trailerVideoId: z.string().nullable() });

export const featured: Scenario = {
  name: 'featured',
  essential: false,
  needsReady: true,
  requires: ['GET /v1/channels/{idOrHandle}/featured', 'PUT /v1/me/channel/featured'],
  async run({ world, api, state, routes }) {
    const tally = createTally();
    const spotlight =
      routes.has('GET /v1/me/channel/spotlight') && routes.has('PUT /v1/me/channel/spotlight');
    for (const spec of world.featured) {
      const owner = userById(world, spec.ownerId);
      const channelId = state.channelIds.get(spec.ownerId);
      if (!owner || !channelId) continue;
      const actor = actorOf(owner);
      const ids = spec.videoKeys.flatMap((key) => {
        const video = state.videos.get(key);
        return video?.status === 'READY' ? [video.id] : [];
      });
      if (ids.length === 0) continue;

      const shelf = await api.send(
        { actor, method: 'GET', path: `/v1/channels/${channelId}/featured` },
        ShelfSchema
      );
      if (isErr(shelf)) tally.fail(shelf.error);
      else if (shelf.value.items.map((item) => item.id).join() === ids.join()) tally.existing();
      else {
        const put = await api.send(
          { actor, method: 'PUT', path: '/v1/me/channel/featured', json: { videoIds: ids } },
          AnySchema
        );
        if (isErr(put)) tally.fail(put.error);
        else tally.created();
      }

      const trailer = spec.trailerVideoKey ? state.videos.get(spec.trailerVideoKey) : undefined;
      if (!spotlight || !trailer || trailer.status !== 'READY') continue;
      const current = await api.send(
        { actor, method: 'GET', path: '/v1/me/channel/spotlight' },
        z.unknown()
      );
      const alreadySet =
        !isErr(current) &&
        SpotlightSettingsSchema.safeParse(current.value).data?.trailerVideoId === trailer.id;
      if (alreadySet) tally.existing();
      else {
        const put = await api.send(
          {
            actor,
            method: 'PUT',
            path: '/v1/me/channel/spotlight',
            json: { trailerVideoId: trailer.id, returningVideoId: null, localizations: [] },
          },
          AnySchema
        );
        if (isErr(put)) tally.fail(put.error);
        else tally.created();
      }
    }
    return tally.outcome('shelves and spotlights');
  },
};
