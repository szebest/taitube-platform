# 69: Frontend URL-driven state architecture — search params sync, modal deep-linking (STS pattern) & typesafe routing

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 53 — Frontend architecture modernization · 55 — Modern design system foundation |
| Blocks | 72, 73, 74, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

In premier high-interaction web applications (such as STS, YouTube, and Linear), the URL is the **canonical single source of truth** for all visual states, active dialogs, tabs, and filters. Fragile local component state (`const [isOpen, setIsOpen] = useState(false)`) breaks the web: users cannot share links to active dialogs, pressing the browser Back button exits the entire website rather than closing a modal, and pressing F5 destroys in-progress interactions.

This ticket delivers the **URL-Driven State Architecture & Modal Deep-Linking System (The STS Pattern)**:

1. **URL-Synchronized Modal Engine (`useUrlModal`)**:
   - Central hook `useUrlModal<TParams = Record<string, string>>(modalId: string)` in `apps/web/src/hooks/use-url-modal.ts`:
     - Reads and updates URL search parameters via TanStack Router.
     - Returns `{ isOpen, params, open(params?), close(), toggle() }`.
   - **Back-Button Dismissal:** Opening a modal executes a history push (`replace: false`). Clicking the browser Back button or mobile swipe-back naturally pops the history entry, closing the modal without unloading the underlying view.
   - **Shareable Deep Links:** Any modal URL (e.g. `https://taitube.tv/watch?v=uuid&modal=save-to-playlist`, `https://taitube.tv/watch?v=uuid&modal=share&t=124s`) can be copied, sent to another user, or opened in a new tab, instantly rendering the target page with the modal open.
   - **F5 / Refresh Durability:** Reloading the browser preserves active modal state, form selections, and tab positions.

2. **Core URL-Managed Modals**:
   - `?modal=auth&mode=signin|signup&redirect=...`: Universal authentication dialog with seamless redirect preservation.
   - `?modal=save-to-playlist&videoId=...`: YouTube-grade "Save to Playlist" modal.
   - `?modal=create-playlist`: Standalone new playlist creation dialog.
   - `?modal=share&videoId=...&t=...`: Share video dialog with timestamp toggle and copy link CTA.
   - `?modal=upload`: Creator studio video upload modal / drawer.
   - `?modal=report&targetId=...&targetType=video|comment`: Content moderation report dialog.
   - `?modal=stats-for-nerds`: Live player diagnostic overlay.
   - `?modal=settings&tab=appearance|playback|privacy`: Quick settings overlay.
   - `?modal=confirm-clear-history`: Watch history purge confirmation dialog.

3. **Strict Push vs. Replace Navigation Discipline**:
   - Opening modals: `router.navigate({ search: prev => ({ ...prev, modal: id, ...params }), replace: false })` (Pushes history entry so Back button dismisses modal).
   - Filter toggles, search category chips, tab switches, and seekbar position: `router.navigate({ search: prev => ({ ...prev, ...updates }), replace: true })` (Replaces history entry to avoid trapping the user in hundreds of history entries).

4. **Typesafe Route Search Validation (Zod + TanStack Router)**:
   - Every route in `apps/web/src/routes/` exports a strict Zod `validateSearch` schema:
     - **Home Feed:** `z.object({ category: z.string().optional(), sort: z.enum(['views', 'recent', 'trending']).default('trending'), modal: z.string().optional() })`
     - **Search Page:** `z.object({ q: z.string().default(''), type: z.enum(['all', 'video', 'channel', 'playlist']).default('all'), sort: z.enum(['relevance', 'date', 'views']).default('relevance'), modal: z.string().optional() })`
     - **Watch Page:** `z.object({ v: z.string().uuid(), t: z.number().optional(), list: z.string().optional(), index: z.number().optional(), modal: z.string().optional() })`
     - **Channel Page:** `z.object({ tab: z.enum(['videos', 'playlists', 'about']).default('videos'), modal: z.string().optional() })`
     - **History Page:** `z.object({ filter: z.string().optional(), modal: z.string().optional() })`
     - **Settings Page:** `z.object({ tab: z.enum(['account', 'appearance', 'playback', 'privacy', 'notifications']).default('appearance'), modal: z.string().optional() })`
     - **Creator Studio:** `z.object({ tab: z.enum(['videos', 'analytics', 'comments']).default('videos'), page: z.number().default(1), status: z.string().optional(), modal: z.string().optional() })`

5. **Radix Dialog & Drawer Integration**:
   - Reusable `<UrlModal modalId="..." />` and `<UrlDrawer modalId="..." />` wrappers in `apps/web/src/components/ui/url-modal.tsx`:
     - Binds Radix UI `Dialog.Root` `open` prop directly to `isOpen`.
     - `onOpenChange={(open) => !open && close()}` cleanly removes search parameters from URL.

## Acceptance criteria

- [ ] Central `useUrlModal` hook implemented in `apps/web/src/hooks/use-url-modal.ts` with type-safe parameters.
- [ ] `<UrlModal />` component created in `apps/web/src/components/ui/url-modal.tsx` wrapping Radix Dialog.
- [ ] Modals opening pushes history entry (`replace: false`); browser Back button closes modal without page refresh.
- [ ] Closing modal via backdrop click, Escape key, or 'X' button removes `modal` parameter from URL.
- [ ] Deep-linking test: Navigating directly to `/watch?v=...&modal=share` renders watch page with Share modal open.
- [ ] Push vs Replace discipline verified: changing search filter tabs uses `replace: true`, opening modal uses `replace: false`.
- [ ] Typesafe search parameter schemas configured across all primary routes (`/`, `/search`, `/watch`, `/channels/$handle`, `/studio`).
- [ ] Vitest integration tests in `apps/web/src/__tests__/url-state.integration.test.tsx` asserting search param synchronization, history back actions, and modal URL lifecycle.

## Out of scope

- Direct backend API mutations (handled in respective feature tickets).
- Browser local storage caching of URL parameters.

## Notes for the implementer

- **Clean URL Parameter Removal:** When closing a modal, delete the `modal` key and any associated modal-specific keys (e.g. `videoId`, `mode`) from the search parameters object before navigating.
- **File Length Discipline:** Keep `use-url-modal.ts` and `url-modal.tsx` <= 200 lines each.

## Testing plan

- JSDOM test: Trigger `open('save-to-playlist', { videoId: '123' })`; assert `window.location.search` contains `?modal=save-to-playlist&videoId=123`.
- Back navigation test: Simulate `history.back()`; assert `isOpen` becomes `false` and modal unmounts.
- Deep link test: Mount router with initial URL containing modal query; assert dialog renders immediately.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test` (or `pnpm test`).
- [ ] URL-driven modal behavior verified in browser testing.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
