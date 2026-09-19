# AGENTS.md — @vp/web (Frontend Application)

Instructions for any coding agent working on the Taitube frontend application (`apps/web`).

---

## 1. Scope & Architecture

`apps/web` is the web client for the Taitube video ingestion and streaming platform.
- **Modern Architecture Target:** React 19, TanStack Start (Nitro/Vite 6 server runtime, streaming SSR), TanStack Router (100% type-safe file-based routing), TanStack Query v5, TanStack Form, TanStack Table, Tailwind CSS, Radix UI primitives.
- **Client-Server Boundary:** `apps/web` must NEVER import `adapters/`, `core/ports`, `packages/db`, or server-only packages. It consumes backend services strictly through `@vp/api-client` and `@vp/api-contracts`.

---

## 2. Non-Negotiable Frontend Rules

### Rule 1: Headless UI & Zero Business Logic in Components (Strict Barrier)
- React components must remain strictly presentational and declarative.
- Embedding complex business logic, authorization decisions, inline permission checks, raw fetch/Axios calls, or ad-hoc data manipulation directly inside UI components is a **STRICT ARCHITECTURAL VIOLATION**.
- All stateful logic, authorization checks, data-fetching, and workflow orchestration MUST be factored out into headless custom hooks (e.g. `useCan`, TanStack Query hooks, dedicated domain hooks).
- Components only consume typed data, event callback handlers, and boolean flags exposed by custom hooks.

### Rule 2: Strict Declarative Authorization
- Manual hand-checking of user IDs, roles, or ownership (e.g. `if (user.role !== 'admin' && resource.ownerId !== user.id)`) is strictly forbidden in UI components.
- All authorization decisions must evaluate declaratively via pure `@casl/ability` rule builders from `@vp/core/permissions`.
- In UI, use headless hooks (`const { canEdit } = usePermissions(...)`) or declarative authorization wrappers (`<Can I="update" this={resource}>...</Can>`).

### Rule 3: URL-Driven State Architecture & Modal Deep-Linking (The STS Pattern)
- The browser URL search parameters are the canonical single source of truth for active modals (`?modal=...`), drawers, active tabs, filter chips, and search facets—NOT ephemeral component `useState`.
- **History Discipline:**
  - Opening dialogs and major view switches push history (`replace: false`) so the browser Back button naturally closes the modal.
  - Filter toggling, sort changes, seekbar scrubbing, and search pagination replace history (`replace: true`) to avoid polluting the history stack.
- Every route defines a strict Zod `validateSearch` schema in TanStack Router.

### Rule 4: Presentation Resilience & Zero Layout Shift
- **Hierarchical Error Isolation:** Route-level boundaries catch critical page-level failures (`<NotFoundRoute />`, `<ServerErrorRoute />`). Contextual widget boundaries (`<QueryErrorCard />`) isolate non-critical failures (comments, recommendations) so primary video playback is never interrupted.
- **Layout-Stable Skeletons:** Skeletons must strictly preserve component aspect ratios (16:9 thumbnail, 16:3 banner) and typography heights to guarantee Cumulative Layout Shift `CLS < 0.05`.
- **Classified Retry Policy:** Queries auto-retry at most 3 times with exponential backoff on transient 5xx/network errors, and never on 4xx errors. Mutations must never auto-retry on server responses to guarantee side-effect idempotency.

---

## 3. Dedicated Skills & Knowledge

When working on frontend tasks, refer to:
- **`web-tanstack-query`** (`apps/web/.agents/skills/web-tanstack-query/SKILL.md`): Query keys, caching, infinite feeds, SSR dehydration.
- **`web-headless-ui`** (`apps/web/.agents/skills/web-headless-ui/SKILL.md`): Custom hooks pattern, headless components, URL state sync.
- **`web-player-hls`** (`apps/web/.agents/skills/web-player-hls/SKILL.md`): HLS player integration, WebVTT scrub preview, QoS telemetry.
- **Global Standards:**
  - Declarative Authorization: `docs/standards/authorization.md`
  - Testing Standards: `docs/standards/testing.md`
  - Monorepo Boundaries: `ARCHITECTURE.md`

---

## 4. Local Commands

```bash
# Start local development server
pnpm --filter @vp/web dev

# Run unit and component tests
pnpm --filter @vp/web test

# Typecheck frontend application
pnpm --filter @vp/web typecheck

# Production build
pnpm --filter @vp/web build
```
