import { staticMiddleware } from 'srvx/static';

const ONE_YEAR_SECONDS = 31_536_000;

type Fetch = (request: Request) => Response | Promise<Response>;

export interface StaticAssetsOptions {
  /** The client build. */
  dir: string;
  /** The path prefix of the content-hashed files, such as `/assets/`. */
  hashedPrefix: string;
}

/**
 * Serves a client build from `dir` ahead of the app: the content-hashed files under `hashedPrefix` for a year, as immutable,
 * everything else (the offline page, the service worker) revalidated. A request with no file goes to `app`.
 */
export function withStaticAssets({ dir, hashedPrefix }: StaticAssetsOptions, app: Fetch): Fetch {
  const hashed = staticMiddleware({ dir, maxAge: ONE_YEAR_SECONDS, immutable: true });
  const rest = staticMiddleware({ dir });
  return (request) => {
    const files = new URL(request.url).pathname.startsWith(hashedPrefix) ? hashed : rest;
    return files(request, () => app(request));
  };
}
