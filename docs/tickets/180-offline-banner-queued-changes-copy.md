# 180: Offline banner - show how many queued changes will sync, or stop building the line

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 68 - PWA, service worker, offline cache and background sync |
| Blocks | — |
| Spec | [68 PWA](68-pwa-service-worker-offline-cache-background-sync.md) |

**Status:** ready

## What to build

A decision, then the small change it implies. A viewer who queued a like or a comment while offline should be able to see that it is waiting.

Today `OfflineBanner` (`apps/client/web/src/features/offline/components/offline-banner/offline-banner.tsx`) renders `OfflineState.Description` with `pwa.offlineQueuedChanges` ("N changes will sync when the connection returns") when the worker reports a queue, and `pwa.offlineBannerDescription` otherwise. The `banner` size variant in `offline-state.variants.ts` sets `description: 'hidden'`, so on every page the line is in the DOM and invisible; only the full-page `/offline/` shows it. `useQueuedChanges` and the message are built and tested (`offline-banner.dom.test.tsx` asserts the text is found) but the user never sees it.

Decided: show the count in the banner, in the title row on one line and truncated, since the slim bar has room at `medium` and above and the count is the one thing the bar can say that the title cannot. On narrow screens keep the bar to the title and the retry icon, and expose the count to assistive technology through the existing status region.

If the owner prefers a bare banner, the other outcome is to delete the description from the banner, `useQueuedChanges` from it, and the unused copy, so no dead UI is built. Either is acceptable; "built and hidden" is not.

## Acceptance criteria

- [ ] At `medium` and wider, the banner shows the queued count when it is above zero ("2 changes will sync when the connection returns"), and nothing extra when it is zero.
- [ ] On narrow widths the count is in the status region read by screen readers and the visual bar stays one line.
- [ ] The text stays in `pwa` messages (en and pl), plural forms intact; no hard-coded string.
- [ ] The existing banner spec is updated to assert it is visible (not only present in the DOM), and an axe pass covers both widths.
- [ ] A browser check in `apps/client/web/e2e/pwa.test.ts` or a recorded screenshot shows the banner with a queued like.
- [ ] `description: 'hidden'` is gone from the banner variant, or the whole description is removed from the banner, per the decision.

## Setup & environment

None.

## Out of scope

- The offline toast, the retry button, reconnect behaviour, and the queue itself.
- The studio app (it has no offline banner today; check before assuming).

## Notes for the implementer

- Raised as an open question in the body of [#297](https://github.com/szebest/taitube-platform/pull/297) (ticket 68 hardening): "the offline banner's description is `hidden`, so 'N changes will sync when the connection returns' is invisible on every page except `/offline/`". Confirmed on this branch.
- Write the decision as "Decided: ..." in *Open questions* when you pick.

## Testing plan

Update `offline-banner.dom.test.tsx`; one narrow and one wide render with axe; the browser proof above.

## Open questions

- Show the count (default above) or remove the dead description. Decide in the PR.

## Definition of Done

- [ ] Merged; `gen-index.py` re-run.
