---
name: cloudflare-r2
description: Use Cloudflare R2 through the S3 API (presigned PUT/GET, multipart uploads, lifecycle rules, custom CDN domain, scoped API tokens) and manage R2/DNS/Tunnel with the Cloudflare Terraform provider. Use when writing or debugging storage code that must run on MinIO locally and R2 in the cloud, or when writing Cloudflare Terraform.
license: Apache-2.0
metadata:
  upstream: cloudflare/skills (skills/cloudflare) — trimmed to the R2 and Terraform references
  project: video-pipeline
---

# Cloudflare R2 (S3 API) + Cloudflare Terraform

Trimmed from the official `cloudflare/skills` skill: only `references/r2/*` and `references/terraform/*` are kept (the upstream SKILL.md is preserved as `references/UPSTREAM-SKILL.md` for the decision trees). Your knowledge of limits and pricing may be stale — **prefer the Cloudflare docs** (`https://developers.cloudflare.com/r2/`) over memory for numbers.

## When to use
- Implementing or reviewing `packages/storage` code that must behave identically on MinIO (local) and R2 (cloud).
- Writing presigned URL / multipart upload flows (tickets 05, 11).
- Writing Terraform for R2 buckets, lifecycle rules, custom domains, DNS, Tunnel, Access (ticket 31).

## Project rules (from `docs/SDD.md` §7, §16.4, ADR-06, ADR-09)
- One `@aws-sdk/client-s3` client for every provider; differences are **env only**: MinIO `S3_FORCE_PATH_STYLE=true`, `S3_REGION=us-east-1`; R2 `S3_REGION=auto`, endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, path style off. No `if (provider === 'r2')` branches.
- Two buckets: `raw` (private; lifecycle: expire 7 d, abort incomplete multipart 1 d) and `public` (private bucket, read via the R2 **custom domain** fronted by the Cloudflare CDN — never expose `*.r2.dev`).
- Object keys are deterministic and built only by `packages/storage/keys.ts` (see SDD §7).
- Presigned URLs: TTL ≤ 15 min in the app; R2 caps presign expiry at 7 days; **R2 has no POST-policy (form) uploads** — use presigned PUT and multipart `UploadPart` URLs.
- Sign `Content-Type` and `Content-Length` into single-PUT URLs; verify with `HeadObject` after `complete` (the app trigger is the explicit `complete` call — **R2 event notifications only target Cloudflare Queues**, so never rely on bucket notifications).
- Scoped tokens: API token may `Put/Get/Head/Multipart*` on `raw` only; worker token `Get` on `raw`, `Put/Delete` on `public`.
- Cost guardrail: every segment upload is one Class A op; watch `storage_ops_total{op="put"}` against the free tier (SDD §12.3).

## Procedure: multipart upload on R2 vs MinIO
1. `CreateMultipartUpload` (server) → store `UploadId` in `uploads.multipart_upload_id`.
2. Presign `UploadPart` URLs in batches (≤ 100) with `partNumber`, TTL 15 min; part size `clamp(ceil(size/1000), 8 MiB, 64 MiB)`; ≤ 10 000 parts.
3. Client PUTs parts, collects `ETag`s; resume via `ListParts`.
4. `CompleteMultipartUpload` with `{PartNumber, ETag}` sorted ascending; then `HeadObject` to verify size/type.
5. `AbortMultipartUpload` on `DELETE /uploads/:id`; lifecycle rule `AbortIncompleteMultipartUpload` as backstop.
6. Test against MinIO in CI; run the same suite against R2 behind `STORAGE_E2E_R2=1` before a cloud deploy.

Details, gotchas and API examples: `references/r2/api.md`, `references/r2/gotchas.md`, `references/r2/patterns.md`, `references/r2/configuration.md`.

## Terraform (ticket 31)
Use `references/terraform/*` (provider v5 resource renames such as `cloudflare_record` → `cloudflare_dns_record`). Resources needed: `cloudflare_r2_bucket` ×2 (+ lifecycle), `cloudflare_r2_custom_domain`, `cloudflare_dns_record` for `api.`/`cdn.`, `cloudflare_zero_trust_tunnel_cloudflared` (+ config), `cloudflare_zero_trust_access_application` for `/admin`. Test with `terraform test` + mocked provider (see the `terraform-test` skill).
