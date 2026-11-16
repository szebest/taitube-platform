import { isErr } from '@vp/result';
import { z } from 'zod';
import { AnySchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

const MyReactionSchema = z.object({ reaction: z.string().nullable() });

export const reactions: Scenario = {
  name: 'reactions',
  essential: false,
  needsReady: true,
  requires: ['GET /v1/videos/{id}/reactions/me', 'PUT /v1/videos/{id}/reactions'],
  async run({ world, api, state }) {
    const tally = createTally();
    for (const spec of world.reactions) {
      const video = state.videos.get(spec.videoKey);
      const user = userById(world, spec.userId);
      if (!video || video.status !== 'READY' || !user) continue;
      const actor = actorOf(user);
      const mine = await api.send(
        { actor, method: 'GET', path: `/v1/videos/${video.id}/reactions/me` },
        MyReactionSchema
      );
      if (isErr(mine)) {
        tally.fail(mine.error);
        continue;
      }
      if (mine.value.reaction === spec.type) {
        tally.existing();
        continue;
      }
      const put = await api.send(
        {
          actor,
          method: 'PUT',
          path: `/v1/videos/${video.id}/reactions`,
          json: { type: spec.type },
        },
        AnySchema
      );
      if (isErr(put)) tally.fail(put.error);
      else tally.created();
    }
    return tally.outcome('reactions');
  },
};
