import { Container } from '@kit/composition';
import { expectOk } from '@kit/testing/result';
import { registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { Services, registerServices } from '../services.module';

describe('apps/server/api/composition: service set module', () => {
  it('hands the routes the very instances the container resolves', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));

    const set = c.get(Services.ServiceSet);

    expect(set.searchService).toBe(c.get(Services.SearchService));
    expect(set.videoService).toBe(c.get(Services.VideoService));
    expectOk(await c.dispose());
  });
});
