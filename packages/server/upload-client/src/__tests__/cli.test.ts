import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { type CliHost, run } from '../cli';

function host(argv: string[], env: CliHost['env'] = {}): CliHost {
  return {
    argv,
    env,
    print: vi.fn(),
    log: createLogger({
      service: 'upload-client',
      level: 'info',
      format: 'pretty',
      destination: captureLog().destination,
    }),
  };
}

describe('packages/upload-client: run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([[[]], [['--help']], [['-h']]])('prints the usage for %j', async (argv) => {
    const cli = host(argv);

    await run(cli);

    expect(cli.print).toHaveBeenCalledWith(expect.stringContaining('pnpm upload-client <file>'));
  });

  it('aborts the upload it is given, against the API and with the token the env names', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await run(
      host(['--abort', 'upl-1'], { API_BASE_URL: 'http://api.test', DEV_TOKEN: 'dev-jwt' })
    );

    expect(fetch).toHaveBeenCalledWith('http://api.test/v1/uploads/upl-1', {
      method: 'DELETE',
      headers: { authorization: 'Bearer dev-jwt' },
    });
  });

  it('refuses a file that does not exist', async () => {
    await expect(run(host(['/no/such/video.mp4']))).rejects.toThrow(
      'File not found at "/no/such/video.mp4"'
    );
  });
});
