describe('apps/worker: main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts nothing, and installs no signal handler, when a spec loads it', async () => {
    const on = vi.spyOn(process, 'on');
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await import('../main');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(on).not.toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(exit).not.toHaveBeenCalled();
  });
});
