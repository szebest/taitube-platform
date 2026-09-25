import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { type CliHost, run } from '../cli';
import { mintToken } from '../jwt';
import { DEV_KEY_ID } from '../keys';

function recordingHost(argv: string[]) {
  const printed: string[] = [];
  const host: CliHost = {
    argv,
    print: (text) => printed.push(text),
    log: createLogger({
      service: 'dev-token',
      level: 'info',
      format: 'pretty',
      destination: captureLog().destination,
    }),
  };
  return { host, printed };
}

describe('packages/dev-token: run', () => {
  it.each([{ argv: ['--help'] }, { argv: ['-h'] }, { argv: ['mint', '--help'] }, { argv: [] }])(
    'prints its usage for $argv and mints nothing',
    async ({ argv }) => {
      const { host, printed } = recordingHost(argv);

      await run(host);

      expect(printed.join('')).toContain('Usage:');
    }
  );

  it('prints the dev JWKS for `jwks`', async () => {
    const { host, printed } = recordingHost(['jwks']);

    await run(host);

    expect(JSON.parse(printed[0] ?? '').keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('prints only the token for `mint --raw`', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await run(recordingHost(['mint', '--role', 'admin', '--raw']).host);

    expect(String(write.mock.calls[0]?.[0]).split('.')).toHaveLength(3);
  });

  it('prints the payload of a valid token for `verify`', async () => {
    const { host, printed } = recordingHost([
      'verify',
      mintToken({ sub: 'usr-1', role: 'admin', ttl: '1h' }),
    ]);

    await run(host);

    expect(JSON.parse(printed[0] ?? '')).toMatchObject({ sub: 'usr-1', role: 'admin' });
  });

  it.each([
    {
      input: 'a token signed by another key',
      argv: ['verify', mintToken({ seed: 'another-key' })],
      error: /signature verification failed/,
    },
    { input: 'no token', argv: ['verify'], error: /needs a token/ },
  ])('rejects `verify` given $input', async ({ argv, error }) => {
    await expect(run(recordingHost(argv).host)).rejects.toThrow(error);
  });
});
