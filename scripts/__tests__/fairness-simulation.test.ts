import { resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../fairness-simulation.ts');

describe('scripts: pnpm fairness', () => {
  it('finishes the pro user ahead of the free user and says so', () => {
    const run = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Fairness assertion verified:         PASSED');
  });
});
