import { type ServerRender, serverRender as render } from '@kit/web-testing/server';
import type { AnyRouter } from '@tanstack/react-router';
import type { HttpHandler } from 'msw/http';
import { apiServer } from './api-server';

type ServerRenderOptions = {
  handlers?: HttpHandler[];
  /** The request's headers, the theme cookie among them. */
  headers?: HeadersInit;
};

/** `@kit/web-testing`'s `serverRender`, with the API handlers the page's loaders call answered. */
export async function serverRender(
  getRouter: () => AnyRouter,
  path: string,
  { handlers = [], headers }: ServerRenderOptions = {}
): Promise<ServerRender> {
  apiServer.use(...handlers);
  return render(getRouter, path, { headers });
}
