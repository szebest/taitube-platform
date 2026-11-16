import { isErr } from '@vp/result';
import { CategoryListSchema, CreatedCategorySchema } from '../responses';
import { actorOf, type Scenario, userByKind } from '../scenario';
import { createTally } from '../tally';

export const categories: Scenario = {
  name: 'categories',
  essential: false,
  needsReady: false,
  requires: ['GET /v1/categories', 'POST /v1/admin/categories'],
  async run({ world, api, state }) {
    const tally = createTally();
    const admin = userByKind(world, 'admin');
    const listed = await api.send({ method: 'GET', path: '/v1/categories' }, CategoryListSchema);
    if (isErr(listed)) return { status: 'failed', detail: 'could not list categories' };
    for (const { slug, id } of listed.value) state.categoryIds.set(slug, id);

    for (const category of world.categories) {
      if (state.categoryIds.has(category.slug)) {
        tally.existing();
        continue;
      }
      if (!admin) continue;
      const created = await api.send(
        {
          actor: actorOf(admin),
          method: 'POST',
          path: '/v1/admin/categories',
          json: {
            name: category.name,
            slug: category.slug,
            description: category.description,
            sortOrder: category.sortOrder,
          },
        },
        CreatedCategorySchema
      );
      if (isErr(created)) tally.fail(created.error);
      else {
        state.categoryIds.set(created.value.slug, created.value.id);
        tally.created();
      }
    }
    return tally.outcome('categories');
  },
};
