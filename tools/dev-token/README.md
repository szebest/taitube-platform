# tools/dev-token — EdDSA JWT Issuer & JWKS Provider

`dev-token` provides offline, local-first JWT issuance and verification using the **EdDSA (Ed25519)** algorithm. It allows developers, tests, and load test scripts (k6) to authenticate against the API without requiring any external Identity Provider (PRD FR-15, SDD §11).

## Commands

```bash
# Mint an admin JWT with 8-hour TTL
pnpm dev-token mint --sub 00000000-0000-7000-8000-000000000001 --role admin --ttl 8h

# Output only the raw JWT string (useful for shell scripting and curl)
TOKEN=$(pnpm dev-token mint --role admin --raw)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/videos

# Print JWKS JSON
pnpm dev-token jwks

# Start a local standalone JWKS HTTP server (port 3001 by default)
pnpm dev-token serve --port 3001
```

## Architecture & Design Decision

### JWKS Serving in Development
As outlined in **SDD §11** and **Ticket 03**:
- In development (`NODE_ENV=development`), `apps/api` serves the dev JWKS directly at `GET /.well-known/jwks.json` on its own port (e.g. `http://localhost:3000/.well-known/jwks.json`), backed by the deterministic Ed25519 key definition from `tools/dev-token`.
- For standalone testing before booting the API (e.g., in unit tests or isolated load tests), `pnpm dev-token serve --port 3001` runs a standalone lightweight HTTP server serving the exact same JWKS.
- The keypair is deterministically derived from a fixed seed, guaranteeing byte-identical keys across every clone, machine, and CI runner without committing private keys to git.

### Token Claims
Every minted token contains:
- `iss`: `vp-dev` (matches `AUTH_ISSUER` default)
- `aud`: `vp-api` (matches `AUTH_AUDIENCE` default)
- `sub`: User ID UUID (defaults to dev user `00000000-0000-7000-8000-000000000001`)
- `role`: Role claim (`user` or `admin`)
- `iat`: Issued-at UNIX timestamp
- `exp`: Expiration UNIX timestamp calculated from `--ttl`
