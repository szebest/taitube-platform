import { fileURLToPath } from 'node:url';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const MAIN = fileURLToPath(new URL('../main.ts', import.meta.url));

describe('apps/api: main', () => {
  it('starts nothing, and installs no signal handler, when a spec loads it', async () => {
    const on = vi.spyOn(process, 'on');
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${code}`);
    });

    await import('../main');

    expect(on).not.toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(exit).not.toHaveBeenCalled();
  });

  it('reads the real environment and exits the real process with its code', () => {
    const child = runEntrypoint(MAIN, [], {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      PORT: '0',
    });

    expect(child.status).toBe(1);
    expect(child.stdout).toContain('api could not start');
    expect(child.stdout).toContain('S3_ACCESS_KEY_ID: is required in production');
  });
});
