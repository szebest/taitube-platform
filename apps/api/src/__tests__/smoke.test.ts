import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('@vp/api smoke test', () => {
  it('builds the API application successfully', () => {
    const app = buildApp();
    expect(app.name).toBe('video-pipeline-api');
    expect(app.status).toBe('initialized');
  });
});
