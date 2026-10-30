import { isPageNavigation } from './route-matchers';

export const OFFLINE_PAGE_URL = '/offline/';

type MatchPrecache = (url: string) => Promise<Response | undefined>;

/**
 * The answer to a page load that failed: the precached offline page. Anything else that failed
 * stays a network error, which is what the page that asked for it already handles.
 */
export function offlineFallback(matchPrecache: MatchPrecache) {
  return async ({ request, url }: { request: Request; url: URL }): Promise<Response> => {
    if (!isPageNavigation(url, request.mode)) {
      return Response.error();
    }
    return (await matchPrecache(OFFLINE_PAGE_URL)) ?? Response.error();
  };
}
