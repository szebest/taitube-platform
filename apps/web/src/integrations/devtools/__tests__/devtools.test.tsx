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

describe('apps/web: devtools', () => {
  afterEach(() => {
    vi.doUnmock('@tanstack/react-router-devtools');
    vi.doUnmock('@tanstack/react-query-devtools');
    vi.resetModules();
  });

  it('mounts the router and the query devtools in opposite corners', async () => {
    const Devtools = await loadDevtools();

    expect(renderToStaticMarkup(<Devtools />)).toBe(
      '<i>router at bottom-right</i><i>query at bottom-left</i>'
    );
  });
});
