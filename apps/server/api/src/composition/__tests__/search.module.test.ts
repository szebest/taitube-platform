import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { Services, registerServices } from '../services.module';

const OWNER = '00000000-0000-7000-8000-00000000f201';
const VIDEO = '00000000-0000-7000-8000-00000000f202';

describe('apps/api/composition: search module', () => {
  it('searches the repositories, cache and suggestion index the rest of the API shares', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    expectOk(
      await c.get(Adapters.Repositories).videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Composable search',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/search.mp4',
        posterKey: `videos/${VIDEO}/thumbs/poster.jpg`,
      })
    );

    const page = expectOk(
      await c
        .get(Services.SearchService)
        .search({ q: 'composable', type: 'all', sort: 'relevance', limit: 20 })
    );

    expect(page.data.items).toMatchObject([
      {
        type: 'video',
        data: { id: VIDEO, thumbnailUrl: `http://cdn.example/videos/${VIDEO}/thumbs/poster.jpg` },
      },
    ]);
    expect(expectOk(await c.get(Adapters.SearchSuggestions).suggest('comp', 10))).toEqual([
      'composable',
    ]);
    expectOk(await c.dispose());
  });
});
