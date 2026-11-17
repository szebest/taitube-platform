# @kit/security-headers

Request middleware for TanStack Start apps: a per-request CSP nonce, the security headers, a cross-site write guard,
and a static file server for the client build.

```sh
pnpm add @kit/security-headers @tanstack/react-start srvx
```

It reads no token. The app hands it the values that differ per app: the options of `createSecurityHeadersMiddleware`,
and the build directory and hashed path prefix of `withStaticAssets`.

```ts
import { clientAppRequestMiddleware } from '@kit/security-headers';
import { withStaticAssets } from '@kit/security-headers/static-assets';

createStart(() => ({ requestMiddleware: clientAppRequestMiddleware }));

export const fetch = withStaticAssets({ dir: buildDir, hashedPrefix: '/assets/' }, handler);
```
