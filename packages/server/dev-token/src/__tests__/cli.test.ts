import { run } from '../cli';
import { mintToken } from '../jwt';
import { DEV_KEY_ID } from '../keys';

describe('packages/dev-token: run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the dev JWKS for `jwks`', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run({ argv: ['jwks'] });

    expect(JSON.parse(String(log.mock.calls[0]?.[0])).keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('prints only the token for `mint --raw`', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await run({ argv: ['mint', '--role', 'admin', '--raw'] });

    expect(String(write.mock.calls[0]?.[0]).split('.')).toHaveLength(3);
  });

  it('prints the payload of a valid token for `verify`', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run({ argv: ['verify', mintToken({ sub: 'usr-1', role: 'admin', ttl: '1h' })] });

    expect(log).toHaveBeenCalledWith('✓ Token valid:');
  });

  it.each([
    {
      input: 'a token signed by another key',
      argv: ['verify', mintToken({ seed: 'another-key' })],
      error: /signature verification failed/,
    },
    { input: 'no token', argv: ['verify'], error: /needs a token/ },
  ])('rejects `verify` given $input', async ({ argv, error }) => {
    await expect(run({ argv })).rejects.toThrow(error);
  });
});
