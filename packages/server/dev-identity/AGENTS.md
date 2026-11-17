# AGENTS.md: @vp/dev-identity

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

This repository's dev identity provider: the issuer, audience, key id, seed and routes every dev token, JWKS and
`DevTokenVerifier` here agree on, plus `mintToken`, `verifyToken`, `getDevJwks` and `mintPersonaToken` bound to them.
`@kit/dev-token` is the generic engine and takes a `DevTokenConfig`; this package is the one place that provides it.
Change a value here and every dev token minted before stops verifying.
