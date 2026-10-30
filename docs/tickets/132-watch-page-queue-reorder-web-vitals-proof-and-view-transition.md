# 132: Watch page follow-ups - queue reorder on a real queue, the LCP and CLS proof, the view transition check

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 59 - Modern video watch page |
| Blocks | — |
| Spec | [Design README section 8, Watch page](../design/README.md#watch-page) |

**Status:** ready

> **Why.** [59](59-video-watch-page-responsive-layout-enhancements.md) merged with these four criteria unmet or unproven, so they moved here instead of holding 59 and everything it blocks at `in-progress`.

## What to build

- **Queue reorder.** `WatchQueue` passes `reorder` to `Queue.Root` over 95's `SortableList`, but without a playlist the queue holds one video, so there is nothing to reorder on the page. Prove pick up, move and drop with the keyboard alone, announced to a screen reader, once [73](73-frontend-youtube-playlists-library-player-queue.md) fills the queue; until then prove it on a seeded queue in a spec.
- **LCP and CLS.** Measure `/watch/<id>` on the server render: the poster is the LCP element and nothing above the fold is larger; CLS stays under 0.05 including the comments load. Record the numbers in the PR.
- **View transition.** With view transitions available a card's thumbnail morphs into the stage; under reduced motion the navigation has no motion. `stage.tsx` and `video-card.tsx` carry the names, so this is a check in a real browser plus a fix for whatever it finds.

## Acceptance criteria

- [ ] The queue reorders with the keyboard alone (pick up, move, drop, announced to a screen reader) through
      the `SortableList` primitive from 95.
- [ ] The poster in the stage is the LCP element of the server render, and no other page element is
      larger above the fold.
- [ ] Loading the discussion shifts nothing above it (CLS under 0.05 on `/watch/<id>` including the comments
      load).
- [ ] With view transitions available, a card's thumbnail morphs into the stage; under reduced motion the
      navigation has no motion.
- [ ] `pnpm typecheck`, `pnpm lint` and the touched packages' tests pass, with output in the PR.

## Out of scope

- Filling the queue from a playlist: 73.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
