import { renderToStaticMarkup } from 'react-dom/server';
import Devtools from '../devtools';

vi.mock(import('@tanstack/react-router-devtools'), () => ({
  TanStackRouterDevtools: ({ position }: { position?: string }) => <i>{`router at ${position}`}</i>,
}));
vi.mock(import('@tanstack/react-query-devtools'), () => ({
  ReactQueryDevtools: ({ buttonPosition }: { buttonPosition?: string }) => (
    <i>{`query at ${buttonPosition}`}</i>
  ),
}));

describe('apps/web: devtools', () => {
  it('mounts the router and the query devtools in opposite corners', () => {
    expect(renderToStaticMarkup(<Devtools />)).toBe(
      '<i>router at bottom-right</i><i>query at bottom-left</i>'
    );
  });
});
