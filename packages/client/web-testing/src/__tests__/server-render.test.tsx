import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { serverRender } from '../server-render';

const rootRoute = createRootRoute({
  component: () => (
    <html lang="en">
      <body>
        <header>Taitube</header>
        <main className="page">
          <Outlet />
        </main>
      </body>
    </html>
  ),
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>Home</p> }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/old',
    beforeLoad: () => {
      throw redirect({ to: '/' });
    },
  }),
]);

const getRouter = () => createRouter({ routeTree });

describe('@vp/web-testing: serverRender', () => {
  it('answers the page the router renders, and its main area without the layout', async () => {
    const rendered = await serverRender(getRouter, '/');

    expect(rendered.status).toBe(200);
    expect(rendered.html).toContain('<header>Taitube</header>');
    expect(rendered.main).toContain('<main class="page">');
    expect(rendered.main).toContain('<p>Home</p>');
    expect(rendered.main).not.toContain('Taitube');
  });

  it('answers a redirect with the location it sends the browser to', async () => {
    const rendered = await serverRender(getRouter, '/old');

    expect(rendered).toMatchObject({ status: 307, location: '/' });
  });
});
