import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

describe('apps/worker: main', () => {
  it('starts nothing, and exits clean, when a spec loads it', () => {
    const loaded = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH, NODE_ENV: 'test' });

    expect(loaded.status).toBe(0);
    expect(loaded.stdout).toBe('');
  });
});
