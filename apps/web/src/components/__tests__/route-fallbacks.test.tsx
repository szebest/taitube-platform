import { renderPage } from '#app/__tests__/render-page';
import { RouteError, RouteNotFound, RoutePending } from '../route-fallbacks';

describe('apps/web: route fallbacks', () => {
  it.each([
    { name: 'pending', Fallback: RoutePending, shows: 'aria-label="Loading"' },
    { name: 'error', Fallback: RouteError, shows: 'There was an error while loading the page' },
    { name: 'not-found', Fallback: RouteNotFound, shows: 'This page does not exist.' },
  ])('renders the $name page', async ({ Fallback, shows }) => {
    expect(await renderPage(<Fallback />)).toContain(shows);
  });

  it('sends a lost viewer back to the home page', async () => {
    expect(await renderPage(<RouteNotFound />)).toContain('href="/"');
  });
});
