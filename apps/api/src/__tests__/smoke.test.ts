import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('@vp/api smoke test', () => {
  it('builds the API application successfully', async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
    await app.close();
  });
});
