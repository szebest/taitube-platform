# @vp/web — Taitube Web Frontend

The web client for the Taitube video ingestion, processing, and streaming platform.

---

## Overview

`@vp/web` is the user-facing web application for Taitube. It provides YouTube-like responsive video browsing, adaptive-bitrate HLS playback with interactive timeline scrub previews, direct multipart upload progress monitoring via Server-Sent Events (SSE), creator channel profiles, and role-based moderation interfaces.

---

## Architectural Stack

- **Framework:** React 19 with TanStack Start (Nitro/Vite 6 server runtime, streaming SSR)
- **Routing:** TanStack Router (100% type-safe file routes with Zod search parameter validation)
- **Data Fetching:** TanStack Query v5 (SSR hydration, optimistic mutations, resilient retry policy)
- **Forms & Tables:** TanStack Form (reactive validation) and TanStack Table v8 (headless tables for Creator Studio)
- **Styling:** Tailwind CSS with Radix UI headless accessible primitives
- **Media Playback:** HLS.js video engine with WebVTT thumbnail scrub preview and telemetry beacon
- **Authorization:** Declarative CASL permission checks via `<Can />` and `useCan` hook (`@vp/core/permissions`)
- **API Client:** Fully typed client consuming `@vp/api-client` and `@vp/api-contracts`

---

## Core Invariants

1. **Headless UI & Presentation Isolation:** React components are strictly presentational. All state, data-fetching, and business logic live in headless custom hooks.
2. **URL as Single Source of Truth (STS Pattern):** Active modals (`?modal=...`), drawers, active tabs, filter chips, and search facets sync to URL search parameters.
3. **Zero Layout Shift:** Dimensionally calibrated skeleton loaders preserve exact component aspect ratios (`CLS < 0.05`).
4. **Client-Server Boundary:** `@vp/web` never imports backend adapters or server database packages.

---

## Development

```bash
# Start development server
pnpm --filter @vp/web dev

# Run test suite
pnpm --filter @vp/web test

# Build production bundle
pnpm --filter @vp/web build
```

For agent guidelines and architectural conventions, see [AGENTS.md](AGENTS.md).
