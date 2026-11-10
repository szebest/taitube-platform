/**
 * `@vp/security-headers` serves a built app's files through `srvx/static`, which reads them with
 * `node:fs`. `@vp/queries` imports the package for its nonce, so a story loads it too and never
 * serves a file.
 */
export const staticMiddleware = (): undefined => undefined;
