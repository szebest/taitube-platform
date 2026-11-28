# Changelog

## 0.2.1

- `verifyToken` words the unsupported-algorithm error with the algorithm as JSON (`got "RS256"`, `got undefined`) instead of interpolating an unknown value.

## 0.2.0

- `DevTokenConfig` takes a required `now: () => number`; `mintToken` stamps `iat` and `verifyToken` checks `exp` against it instead of `Date.now()`.

## 0.1.0

- First release: the public API recorded in api/dev-token.api.txt.
