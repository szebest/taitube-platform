# Changelog

## 0.2.0

- `DevTokenConfig` takes a required `now: () => number`; `mintToken` stamps `iat` and `verifyToken` checks `exp` against it instead of `Date.now()`.

## 0.1.0

- First release: the public API recorded in api/dev-token.api.txt.
