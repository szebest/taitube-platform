import { createQueryClient, guestSession } from '@vp/queries';

import { RouteError, RouteNotFound, RoutePending } from '#app/components/route-fallbacks';
import { getRouter } from '#app/router';

describe('apps/client/studio: router', () => {
  it('builds a new query cache for every router, so no two requests share one', () => {
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient
    );
  });

  it('renders for a guest', () => {
    expect(getRouter().options.context.auth).toEqual({ status: 'guest' });
  });

  it('puts the query cache and session it is handed in context', () => {
    const queryClient = createQueryClient();
    const auth = guestSession();

    const { context } = getRouter({ queryClient, auth }).options;

    expect(context.queryClient).toBe(queryClient);
    expect(context.auth).toBe(auth);
  });

  it("stamps the request's CSP nonce on the scripts it renders", () => {
    expect(getRouter({ nonce: 'n0nce' }).options.ssr?.nonce).toBe('n0nce');
  });

  it('registers the pending, error and not-found pages every route falls back to', () => {
    const { options } = getRouter();

    expect(options.defaultPendingComponent).toBe(RoutePending);
    expect(options.defaultErrorComponent).toBe(RouteError);
    expect(options.defaultNotFoundComponent).toBe(RouteNotFound);
  });
});
