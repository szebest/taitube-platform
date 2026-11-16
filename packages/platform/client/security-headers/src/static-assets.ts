import { staticMiddleware } from 'srvx/static';

const ONE_YEAR_SECONDS = 31_536_000;
const HASHED_ASSETS_PREFIX = '/assets/';

type Fetch = (request: Request) => Response | Promise<Response>;

/**
 * Serves a client build from `dir` ahead of the app: the content-hashed `/assets/` for a year, as immutable,
 * everything else (the offline page, the service worker) revalidated. A request with no file goes to `app`.
 */
export function withStaticAssets(dir: string, app: Fetch): Fetch {
  const hashed = staticMiddleware({ dir, maxAge: ONE_YEAR_SECONDS, immutable: true });
  const rest = staticMiddleware({ dir });
  return (request) => {
    const files = new URL(request.url).pathname.startsWith(HASHED_ASSETS_PREFIX) ? hashed : rest;
    return files(request as Parameters<typeof files>[0], () => app(request)) as Promise<Response>;
  };
}
