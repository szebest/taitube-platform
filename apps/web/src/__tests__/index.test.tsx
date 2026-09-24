import { StrictMode } from 'react';

vi.mock(import('react-dom/client'), async (importOriginal) => ({
  ...(await importOriginal()),
  createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })),
}));

async function boot(root: object | null) {
  vi.resetModules();
  vi.stubGlobal('document', { getElementById: (id: string) => (id === 'root' ? root : null) });
  await import('../index');
  const { createRoot } = await import('react-dom/client');
  const { App } = await import('../App');
  return { createRoot, App };
}

describe('apps/web: entrypoint', () => {
  it('mounts the app in strict mode into #root', async () => {
    const root = {};

    const { createRoot, App } = await boot(root);

    expect(createRoot).toHaveBeenCalledWith(root);
    const [mounted] = vi.mocked(createRoot).mock.results;
    expect(mounted?.value.render).toHaveBeenCalledWith(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });

  it('refuses to start on a page without the #root mount point', async () => {
    await expect(boot(null)).rejects.toThrow('index.html is missing the #root mount point');
  });
});
