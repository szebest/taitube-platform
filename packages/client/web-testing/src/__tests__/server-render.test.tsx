import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';
import { LOCAL_API_BASE_URL } from '../local-api';
import { serverRender } from '../server-render';

const rootRoute = createRootRoute({
  component: () => (
    <html lang="en">
      <body>
        <main>Ready</main>
      </body>
    </html>
  ),
});

const getRouter = () =>
  createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        loader: async () => (await fetch(`${LOCAL_API_BASE_URL}/v1/greeting`)).text(),
        component: () => <p>Home</p>,
      }),
    ]),
  });

describe('@vp/web-testing: serverRender', () => {
  it('answers the API calls a page makes with the handlers it is given', async () => {
    let asked = false;
    const rendered = await serverRender(getRouter, '/', {
      handlers: [
        http.get(`${LOCAL_API_BASE_URL}/v1/greeting`, () => {
          asked = true;
          return HttpResponse.text('hello');
        }),
      ],
    });

    expect({ asked, status: rendered.status }).toEqual({ asked: true, status: 200 });
  });
});
