import { isErr } from '@vp/result';
import { PAGE_LIMIT, collectPages } from '../pages';
import { AnySchema, SearchesPageSchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

export const searches: Scenario = {
  name: 'searches',
  essential: false,
  needsReady: false,
  requires: ['GET /v1/search', 'GET /v1/me/searches'],
  async run({ world, api }) {
    const tally = createTally();
    for (const spec of world.searches) {
      const user = userById(world, spec.userId);
      if (!user) continue;
      const actor = actorOf(user);
      const trail = await collectPages(
        api,
        (cursor) => ({
          actor,
          method: 'GET',
          path: '/v1/me/searches',
          query: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
        }),
        SearchesPageSchema
      );
      if (isErr(trail)) {
        tally.fail(trail.error);
        continue;
      }
      if (trail.value.some((entry) => entry.query.toLowerCase() === spec.query.toLowerCase())) {
        tally.existing();
        continue;
      }
      const searched = await api.send(
        { actor, method: 'GET', path: '/v1/search', query: { q: spec.query } },
        AnySchema
      );
      if (isErr(searched)) tally.fail(searched.error);
      else tally.created();
    }
    return tally.outcome('searches');
  },
};
