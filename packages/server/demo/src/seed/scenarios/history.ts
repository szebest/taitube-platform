import { isErr } from '@vp/result';
import { z } from 'zod';
import { AnySchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

const PlayheadSchema = z.object({ playhead: z.unknown().nullable() });

export const history: Scenario = {
  name: 'history',
  essential: false,
  needsReady: true,
  requires: ['GET /v1/me/history/{videoId}', 'POST /v1/me/history'],
  async run({ world, api, state }) {
    const tally = createTally();
    for (const spec of world.history) {
      const video = state.videos.get(spec.videoKey);
      const user = userById(world, spec.userId);
      if (!video || video.status !== 'READY' || !user || video.durationMs === null) continue;
      const actor = actorOf(user);
      const seen = await api.send(
        { actor, method: 'GET', path: `/v1/me/history/${video.id}` },
        PlayheadSchema
      );
      if (isErr(seen)) {
        tally.fail(seen.error);
        continue;
      }
      if (seen.value.playhead !== null) {
        tally.existing();
        continue;
      }
      const durationSeconds = Math.max(1, Math.round(video.durationMs / 1000));
      const saved = await api.send(
        {
          actor,
          method: 'POST',
          path: '/v1/me/history',
          json: {
            videoId: video.id,
            durationSeconds,
            progressSeconds: Math.round(durationSeconds * spec.fraction),
            reason: spec.fraction >= 0.95 ? 'ended' : 'pause',
          },
        },
        AnySchema
      );
      if (isErr(saved)) tally.fail(saved.error);
      else tally.created();
    }
    return tally.outcome('watch history entries');
  },
};
