---
name: local-first-check
description: >-
  Keeping a system runnable on one machine with no external accounts and no internet after
  install: the review checklist for new dependencies, defaults, phone-home and assets, and
  the offline smoke that proves it. Use before merging a change that adds a dependency, a
  host, an environment key, a container or a browser asset.
license: MIT
---

# Local-first check

The whole system runs on one machine with zero external accounts and no internet after a
one-time install and image pull. External providers exist only behind an opt-in cloud
configuration that is empty by default. This repo's rule, files and commands:
`references/this-repo.md`.

## Review checklist

- [ ] **No new external runtime dependency.** Every host in the diff
  (`git diff <base> | grep -nE 'https?://[a-z0-9.-]+\.[a-z]{2,}'`) is `localhost`, a
  container service name, documentation, or behind a cloud-only setting that is empty by
  default.
- [ ] **The example environment file stays all-local**: every uncommented default points at
  `localhost` or a container; cloud values are commented out; the app boots with the file
  unmodified.
- [ ] **Nothing phones home**: tooling telemetry off (`DO_NOT_TRACK=1` and each tool's own
  flag) in the env file, Dockerfiles and CI; a telemetry exporter is a no-op when its
  endpoint is unset; a new library with telemetry on by default gets it disabled.
- [ ] **Browser assets are vendored**: scripts, stylesheets and fonts load from the app's own
  origin, never a CDN.
- [ ] **Images are self-contained**: no package install or download at container start;
  binaries, fonts and CA certificates baked at build; no `pull_policy: always`.
- [ ] **Auth stays local**: a development identity mode that needs no identity provider, and
  a local way to mint a token.
- [ ] **Observability stays local**: a local profile receives everything the cloud setup
  would send elsewhere.
- [ ] **What does need the internet** (install, the optional cloud setup) is listed in one
  doc.

Prefer a machine check over the checklist where one fits: a test that fails on an external
host in source, or on a non-local default in the env file.

## Offline smoke

1. Start the stack on a container network marked `internal: true`, which blocks egress and
   keeps container-to-container traffic and published ports.
2. Prove the block: from inside a container, a connection to a public address fails.
3. Run the normal end-to-end smoke (upload, process, fetch the result).
4. Optionally capture traffic on the host during the run and expect nothing outside the
   private ranges.

## A capability that cannot run locally

Do not adopt it. Record the rejected option and what would make it worth revisiting in the
relevant design decision.
