# 31: Cloud accounts + Terraform — Cloudflare (R2, DNS, Tunnel, Access), Hetzner/Oracle, Neon, Grafana Cloud

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud (can be done any time after 01) |
| Size | M |
| Blocked by | 01 — Repo skeleton |
| Blocks | 32 |
| Spec | [SDD §15.3 External services & accounts](../SDD.md#153-external-services-accounts-to-create-all-free-unless-noted) · [SDD §12.3 Rung 3 + cost model](../SDD.md#123-rung-3-cloud-reference-deployment-phase-4) · [SDD §16.4/16.8 env](../SDD.md#164-object-storage-s3-compatible) · [SDD §17 Fact sheet](../SDD.md#17-fact-sheet-verified-2026-09-03) · [ADR-06](../SDD.md#adr-06-object-storage-minio-locally-cloudflare-r2-in-cloud-backblaze-b2-fallback) · [ADR-15](../SDD.md#adr-15-cloud-hosting-for-the-reference-deployment) |

**Status:** ready-for-agent (human steps flagged)

## What to build
All cloud prerequisites exist and are reproducible: accounts created (human step, checklist provided), and `terraform apply` in `infra/terraform` creates the R2 buckets (`vp-raw`, `vp-public`) with lifecycle rules and a custom CDN domain, DNS records, a Cloudflare Tunnel + Access policy protecting `/admin`, a scoped R2 API token pair (api vs worker permissions), and the Hetzner server (or documents the Oracle A1 path) with a firewall that exposes nothing but the tunnel. Neon and Grafana Cloud are created through their consoles (no/limited Terraform on free tiers) with a documented checklist and the resulting env values recorded in a SOPS-encrypted secrets file.

## Acceptance criteria
- [ ] Checklist in `docs/runbooks/cloud-accounts.md` covering every row of SDD §15.3 with what to click and which env var each output feeds.
- [ ] `terraform plan/apply` idempotent; state stored locally + documented remote option; providers `cloudflare` and `hcloud` pinned.
- [ ] R2: two buckets, lifecycle (raw 7 d, abort multipart 1 d), custom domain `cdn.<domain>` proxied; presigned PUT + GET verified with the `STORAGE_E2E_R2=1` test from 05/11.
- [ ] Tunnel token + Access policy created; `cloudflared` config committed for 32.
- [ ] Hetzner CAX11 (or CX23) created with SSH key only, firewall allowing outbound + SSH from your IP; cost note ≈ €6–7/mo incl. IPv4 and VAT; Oracle path documented with the June-2026 A1 limits.
- [ ] `infra/k8s/overlays/cloud/secrets.enc.yaml` (SOPS + age) holds every 🔒 value from `.env.example` §16.8 and the provider sections; decrypt instructions in README.

## Out of scope
Deploying the apps (32).

## Notes for the implementer
- Free tiers moved three times in 2026 — re-verify SDD §17 before creating anything and update the fact sheet in the same PR if numbers changed.
- A real domain (~€5–10/yr) is the one unavoidable non-VPS cost for a CDN hostname; alternative documented (presigned GET playback).

## Testing plan
Terraform plan in CI (no apply); manual apply with outputs pasted into the checklist.

## Open questions
- Domain name choice — human decision.

## Definition of Done
- [ ] Resources exist; secrets encrypted in repo; checklist complete.
