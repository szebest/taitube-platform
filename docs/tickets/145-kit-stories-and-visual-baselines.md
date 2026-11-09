# 145: Stories and visual baselines for the app kit folders that have none

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 131 - Front-end folder structure, names and boundaries |
| Blocks | — |
| Spec | [131 outcome](131-frontend-folder-structure-names-and-boundaries.md#outcome-the-slices-as-shipped-and-what-was-deferred) - [95 design system 2](95-design-system-2.md) - [frontend-structure.md](../standards/frontend-structure.md) |

**Status:** ready

## What to build

Eight app kit folders ship without a story, so the workbench and the visual suite never draw them: `channel-row`,
`subscribe-action`, `feed-sentinel`, `paged-footer`, `feed-video-card`, `feedback-menu-items`, `video-grid` and
`share-dialog`. Each gets `__stories__/<name>.stories.tsx` and a committed baseline, so a change to one is seen by
the visual shard the way a `@vp/ui` primitive is.

Several of them read a router, a query client or the API client, so the stories need one provider decorator in the
workbench that stands those up from the in-memory API, and not a per-story copy of the provider tree.

## Acceptance criteria

- [ ] Each of the eight folders has a story at its folder root, none in a subcomponent.
- [ ] One workbench decorator supplies the providers; no story builds its own.
- [ ] Baselines are generated with the pinned amd64 Playwright image and committed; the visual shard is green.
- [ ] `STORYLESS` is gone from `tests/architecture/component-folders-pending.ts`.

## Out of scope

- Changing a component's behaviour or markup.
- Stories for `components/player/*`, which the structure standard leaves without one.

## Testing plan

The visual shard over the eight new stories, in the pinned image; `pnpm test:architecture`.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
