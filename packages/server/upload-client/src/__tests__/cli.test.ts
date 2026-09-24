import { run } from '../cli';

describe('packages/upload-client: run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([[[]], [['--help']], [['-h']]])('prints the usage for %j', async (argv) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run({ argv, env: {} });

    expect(String(log.mock.calls[0]?.[0])).toContain('pnpm upload-client <file>');
  });

  it('aborts the upload it is given, against the API and with the token the env names', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await run({
      argv: ['--abort', 'upl-1'],
      env: { API_BASE_URL: 'http://api.test', DEV_TOKEN: 'dev-jwt' },
    });

    expect(fetch).toHaveBeenCalledWith('http://api.test/v1/uploads/upl-1', {
      method: 'DELETE',
      headers: { authorization: 'Bearer dev-jwt' },
    });
  });

  it('refuses a file that does not exist', async () => {
    await expect(run({ argv: ['/no/such/video.mp4'], env: {} })).rejects.toThrow(
      'File not found at "/no/such/video.mp4"'
    );
  });
});
