import { isPageNavigation } from './route-matchers';

export const OFFLINE_PAGE_URL = '/offline/';

type MatchPrecache = (url: string) => Promise<Response | undefined>;

/**
 * The answer to a page load that failed: a redirect to the precached offline page, so the document URL is the offline page's and the router hydrates that route, not the one that failed. Anything else that failed
 * stays a network error, which is what the page that asked for it already handles.
 */
export function offlineFallback(matchPrecache: MatchPrecache) {
  return async ({ request, url }: { request: Request; url: URL }): Promise<Response> => {
    if (!isPageNavigation(url, request.mode)) {
      return Response.error();
    }
    return (await matchPrecache(OFFLINE_PAGE_URL))
      ? Response.redirect(new URL(OFFLINE_PAGE_URL, url.origin).href)
      : Response.error();
  };
}
