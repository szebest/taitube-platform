import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerServices, Services } from '../services.module';

const OWNER = '00000000-0000-7000-8000-00000000f301';
const VIDEO = '00000000-0000-7000-8000-00000000f302';

describe('apps/server/api/composition: discovery module', () => {
  it('builds the home page from the repositories and cache the rest of the API shares', async () => {
    const c = registerServices(
      await registerAdapters(new Container(), inProcessAppConfig({ cdn: 'http://cdn.example/' }))
    );
    expectOk(
      await c.get(Adapters.Repositories).videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Composable home',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/home.mp4',
      })
    );

    const { shelves } = expectOk(await c.get(Services.HomeService).get(null));

    expect(shelves.map(({ kind, items }) => [kind, items.map(({ id }) => id)])).toEqual([
      ['trending', [VIDEO]],
    ]);
    expectOk(await c.dispose());
  });
});
