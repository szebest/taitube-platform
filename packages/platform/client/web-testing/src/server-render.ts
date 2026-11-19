import type { AnyRouter } from '@tanstack/react-router';
import { createRequestHandler, defaultStreamHandler } from '@tanstack/react-router/ssr/server';
import { requestHandler } from '@tanstack/react-start/server';

export type ServerRender = {
  status: number;
  location: string | null;
  html: string;
  /** The page area inside the layout, from its `<main` tag on, without the header and the sidebar. */
  main: string;
};

type ServerRenderOptions = {
  /** The request's headers, the theme cookie among them. */
  headers?: HeadersInit;
};

/**
 * What the server answers for `path`: the app's real route tree and router, rendered to a string
 * inside the request context Start gives the server's code.
 */
export async function serverRender(
  getRouter: () => AnyRouter,
  path: string,
  { headers }: ServerRenderOptions = {}
): Promise<ServerRender> {
  const answer = requestHandler((request) =>
    createRequestHandler({ request, createRouter: () => getRouter() })(defaultStreamHandler)
  );
  const response = await answer(new Request(`http://localhost${path}`, { headers }), {});
  const html = await response.text();
  return {
    status: response.status,
    location: response.headers.get('location'),
    html,
    main: html.slice(html.indexOf('<main'), html.indexOf('</main>')),
  };
}
