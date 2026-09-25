import { registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { registerBootstrap } from '../bootstrap.module';
import { Services, registerServices } from '../services.module';

describe('apps/api/composition: bootstrap module', () => {
  it('builds the bootstrap service over the configured feature flags', async () => {
    const config = inProcessAppConfig({ featureFlags: ['studio'] });
    const c = registerBootstrap(registerServices(await registerAdapters(new Container(), config)));

    const context = expectOk(await c.get(Services.BootstrapService).contextFor(null));

    expect(context.featureFlags).toEqual({ studio: true });
    expectOk(await c.dispose());
  });
});
