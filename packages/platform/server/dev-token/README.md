# @kit/dev-token

Offline EdDSA (Ed25519) JWT issuer, JWKS provider and persona token server for local development. Every function
takes a `DevTokenConfig`; the package holds no issuer, audience, key id, seed or route of its own.

```sh
pnpm add @kit/dev-token
```

Tokens and registries: none. The caller passes a `DevTokenConfig`:
`{ product, issuer, audience, keyId, seed, routes: { jwks, token }, now }`.

```ts
import { type DevTokenConfig, getDevJwks, mintToken, verifyToken } from '@kit/dev-token';

const config: DevTokenConfig = {
  product: 'acme',
  issuer: 'acme-dev',
  audience: 'acme-api',
  keyId: 'acme-key-1',
  seed: 'acme-seed',
  routes: { jwks: ['/jwks.json'], token: '/token' },
  now: () => Date.now(),
};

const token = mintToken(config, { sub: 'user-1', role: 'admin', ttl: '1h' });
verifyToken(config, token);
getDevJwks(config);
```

`run(config, host)` is the CLI (`mint`, `verify`, `jwks`, `serve`); the app wires it to the process.
