import { createRequestHandler, defaultStreamHandler } from '@tanstack/react-router/ssr/server';
import type { HttpHandler } from 'msw';
import { getRouter } from '../router';
import { apiServer } from './msw/api-server';

export type ServerRender = {
  status: number;
  location: string | null;
  html: string;
  /** The page area inside the layout, without the header and the sidebar. */
  main: string;
};

export type ServerRenderOptions = {
  /** How the API answers during the render; a call none of them answers fails the test. */
  handlers?: HttpHandler[];
};

/** What the server answers for `path`: the real route tree and router, rendered to a string. */
export async function serverRender(
  path: string,
  { handlers = [] }: ServerRenderOptions = {}
): Promise<ServerRender> {
  apiServer.use(...handlers);
  const handler = createRequestHandler({
    request: new Request(`http://localhost:5173${path}`),
    createRouter: () => getRouter(),
  });
  const response = await handler(defaultStreamHandler);
  const html = await response.text();
  return {
    status: response.status,
    location: response.headers.get('location'),
    html,
    main: html.slice(html.indexOf('<main>'), html.indexOf('</main>')),
  };
}
