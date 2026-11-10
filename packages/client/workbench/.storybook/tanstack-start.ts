/**
 * The browser half of `@tanstack/react-start`, which a Storybook build cannot load: `@vp/ui` reads
 * its cookies through `createIsomorphicFn`, and a story only ever runs the client side of one. The
 * server-only exports `@vp/queries` imports are present so it bundles; a story never calls them.
 */
export function createIsomorphicFn() {
  const chain = {
    server: () => chain,
    client: <T>(implementation: T) => implementation,
  };
  return chain;
}

export function createServerFn() {
  const builder = {
    inputValidator: () => builder,
    middleware: () => builder,
    handler: <T>(implementation: T) => implementation,
  };
  return builder;
}

export function createMiddleware() {
  const builder = {
    server: <T>(implementation: T) => implementation,
    middleware: () => builder,
  };
  return builder;
}

export const createCsrfMiddleware = (): undefined => undefined;
export const getGlobalStartContext = (): undefined => undefined;
export const getRequestIP = (): undefined => undefined;
export const getCookie = (): undefined => undefined;
export const setCookie = (): undefined => undefined;
export const deleteCookie = (): undefined => undefined;
export const getRequest = (): undefined => undefined;
export const getRequestHeader = (): undefined => undefined;
