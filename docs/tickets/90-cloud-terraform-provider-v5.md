# 90: Cloud Terraform on the Cloudflare v5 provider, validated in CI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 88 — Codebase health to nine |
| Blocks | — |
| Spec | [SDD ADR-15 Cloud hosting](../SDD.md#adr-15--cloud-hosting-for-the-reference-deployment) · [SDD §12.3 Rung 3 Cloud](../SDD.md#123-rung-3--cloud-reference-deployment-phase-4) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready

---

## Why this ticket exists

`infra/terraform` has never been validated by anything. 88 found it (W11, *Decided in 88f*):

- `terraform validate` fails. `cloudflare_r2_bucket_lifecycle`, `cloudflare_r2_custom_domain` and
  `cloudflare_tunnel` are not resources of the pinned provider (`cloudflare ~> 4.35`); the first two exist in
  v5 only, and v5 renames the tunnel resources (`cloudflare_zero_trust_tunnel_cloudflared`, and its config).
- Nothing in CI runs `terraform fmt -check` or `validate`, so the file drifted unformatted until 88f ran
  `fmt` by hand, and the only coverage is `cloud-terraform.test.ts` and `cloud-r2-tokens.test.ts`, which read the
  text.

So the cloud rung has no proof it can be planned, let alone applied.

## What to build

- Port `main.tf`, `providers.tf`, `terraform.tf` and `outputs.tf` to the Cloudflare v5 provider, pinned by
  minor version, with the same resources: two R2 buckets, the raw lifecycle rule, the CDN custom domain, the
  tunnel and its config, the Access application and policy, the two scoped R2 tokens (the worker's reads and
  writes both buckets, the API's `raw` only, as `cloud-r2-tokens.test.ts` holds), and the Hetzner node and
  firewall.
- A CI step, in `lint-typecheck` or its own job, that runs `terraform fmt -check -recursive` and
  `terraform init -backend=false && terraform validate` against a provider cache keyed by
  `.terraform.lock.hcl`, with the lock file committed. `ci-shape.test.ts` holds the step and its budget.
- The two specs keep passing against the ported file; `@cdktf/hcl2json` reads v5 HCL the same way.

## Acceptance criteria

1. `terraform validate` passes with `-backend=false`. Proof: the CI step's output.
2. `terraform fmt -check -recursive` passes in CI and fails on an unformatted fixture. Proof: CI step, and a
   run of it against a misaligned copy.
3. The step fits its job's budget (`timeout-minutes` unchanged, or a new job whose budget `ci-shape` asserts)
   and restores the provider plugins from cache on a second run. Proof: two runs' step timings.
4. The resources and token scopes match what the specs assert today. Proof: `cloud-terraform.test.ts` and
   `cloud-r2-tokens.test.ts` green.
5. SDD §12.3 and `infra/terraform/AGENTS.md` name the provider version and the CI check. Proof: `doc-commands`
   green.

## Out of scope

- Applying the plan. Nothing in CI holds Cloudflare or Hetzner credentials, and none should.
- Remote state. It stays local (`terraform.tf`), as the local-first rule wants.
