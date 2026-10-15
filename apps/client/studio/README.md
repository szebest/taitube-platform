# @vp/studio — Taitube Creator Studio

The creator-facing app of the Taitube platform: uploading and editing videos today, the library, analytics and
the admin panel as the tickets after 93 land. It runs on the same stack as `@vp/web` (React 19 on TanStack
Start, Router and Query, Vite, SSR) and is served and deployed on its own origin, `http://localhost:5174`
locally.

```bash
pnpm --filter @vp/studio dev     # http://localhost:5174
pnpm --filter @vp/studio test
pnpm --filter @vp/studio build
```

For agent guidelines and what differs from the viewer app, see [AGENTS.md](AGENTS.md).
