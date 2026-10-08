import { createRequestHandler, defaultStreamHandler } from '@tanstack/react-router/ssr/server';
import { requestHandler } from '@tanstack/react-start/server';
import type { HttpHandler } from 'msw';

import { getRouter } from '#app/router';
import { apiServer } from './msw/api-server';

export type ServerRender = {
  status: number;
  location: string | null;
  html: string;
  /** The page area inside the layout, without the header and the sidebar. */
  main: string;
};

type ServerRenderOptions = {
  handlers?: HttpHandler[];
  /** The request's headers, the theme cookie among them. */
  headers?: HeadersInit;
};

/**
 * What the server answers for `path`: the real route tree and router, rendered to a string inside
 * the request context Start gives the server's code.
 */
export async function serverRender(
  path: string,
  { handlers = [], headers }: ServerRenderOptions = {}
): Promise<ServerRender> {
  apiServer.use(...handlers);
  const answer = requestHandler((request) =>
    createRequestHandler({ request, createRouter: () => getRouter() })(defaultStreamHandler)
  );
  const response = await answer(new Request(`http://localhost:5173${path}`, { headers }), {});
  const html = await response.text();
  return {
    status: response.status,
    location: response.headers.get('location'),
    html,
    main: html.slice(html.indexOf('<main>'), html.indexOf('</main>')),
  };
}
