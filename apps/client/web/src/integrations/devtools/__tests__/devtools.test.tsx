import { renderToStaticMarkup } from 'react-dom/server';

async function loadDevtools() {
  vi.resetModules();
  vi.doMock(import('@tanstack/react-router-devtools'), () => ({
    TanStackRouterDevtools: ({ position }: { position?: string }) => (
      <i>{`router at ${position}`}</i>
    ),
  }));
  vi.doMock(import('@tanstack/react-query-devtools'), () => ({
    ReactQueryDevtools: ({ buttonPosition }: { buttonPosition?: string }) => (
      <i>{`query at ${buttonPosition}`}</i>
    ),
  }));
  return (await import('../devtools')).default;
}

async function renderDevtools(): Promise<string> {
  const Devtools = await loadDevtools();
  return renderToStaticMarkup(<Devtools />);
}

describe('apps/client/web: devtools', () => {
  afterEach(() => {
    vi.doUnmock('@tanstack/react-router-devtools');
    vi.doUnmock('@tanstack/react-query-devtools');
    vi.resetModules();
  });

  it('mounts the router and the query devtools in opposite corners', async () => {
    expect(await renderDevtools()).toBe('<i>router at bottom-right</i><i>query at bottom-left</i>');
  });
});
