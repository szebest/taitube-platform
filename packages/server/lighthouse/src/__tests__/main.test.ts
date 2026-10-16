import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

describe('packages/lighthouse: pnpm lighthouse', () => {
  it('explains itself on --help and starts nothing', () => {
    const help = runEntrypoint(ENTRYPOINT, ['--help'], { PATH: process.env.PATH });

    expect(help.status).toBe(0);
    expect(help.stdout).toContain('Nothing leaves the machine');
  });
});
