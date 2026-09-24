import { captureLog } from '@vp/testing/log-capture';
import { loadEnvOrExit } from '../load-env-or-exit';

const LOCAL_ENV = { DATABASE_URL: 'postgres://localhost:5432/vp' };

function boot(env: Record<string, string>) {
  const log = captureLog();
  const exits: number[] = [];
  const exit = (code: number): never => {
    exits.push(code);
    throw new Error('exited');
  };
  const loaded = () => loadEnvOrExit('vp-test', { env, exit }, log.destination);
  return { log, exits, loaded };
}

describe('packages/config: loadEnvOrExit', () => {
  it('hands back the environment that parses, and writes nothing', () => {
    const { log, exits, loaded } = boot(LOCAL_ENV);

    expect(loaded().DATABASE_URL).toBe(LOCAL_ENV.DATABASE_URL);
    expect(exits).toEqual([]);
    expect(log.text()).toBe('');
  });

  it('writes one line naming each invalid key, no stack, and exits 1', () => {
    const { log, exits, loaded } = boot({ ...LOCAL_ENV, PORT: 'eighty', ADMIN_TOKEN: 'short' });

    expect(loaded).toThrow('exited');
    expect(exits).toEqual([1]);
    const lines = log.text().trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^fatal invalid environment configuration invalid=\[.*PORT/);
    expect(log.text()).not.toContain('short');
    expect(log.text()).not.toContain('    at ');
  });
});
