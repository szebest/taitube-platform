vi.mock(import('../process'), () => ({ run: vi.fn(async () => undefined) }));

async function boot(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  await import('../main');
  return vi.mocked((await import('../process')).run);
}

describe('apps/api: main', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('starts nothing when a spec loads it', async () => {
    expect(await boot('test')).not.toHaveBeenCalled();
  });

  it('runs the API against the real environment, signals and exit', async () => {
    const on = vi.spyOn(process, 'on').mockReturnValue(process);
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never);
    const handler = () => {};

    const run = await boot('production');
    const [host] = run.mock.calls[0] ?? [];
    host?.onSignal('SIGTERM', handler);
    host?.exit(3);

    expect(run).toHaveBeenCalledTimes(1);
    expect(host?.env).toBe(process.env);
    expect(on).toHaveBeenCalledWith('SIGTERM', handler);
    expect(exit).toHaveBeenCalledWith(3);
  });
});
