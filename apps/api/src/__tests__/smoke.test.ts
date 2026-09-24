import { inProcessAppConfig } from '@vp/env-schema';
import { composeApp } from '../app';

describe('@vp/api smoke test', () => {
  it('builds the API application successfully', async () => {
    const app = (await composeApp({ config: inProcessAppConfig() })).app;
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
    await app.close();
  });
});
