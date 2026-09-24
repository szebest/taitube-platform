import { inProcessAppConfig } from '@vp/env-schema';
import { buildApp } from '../app';

describe('@vp/api smoke test', () => {
  it('builds the API application successfully', async () => {
    const app = await buildApp({ config: inProcessAppConfig() });
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
    await app.close();
  });
});
