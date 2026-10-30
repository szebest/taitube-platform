# 106: Themes beyond the built-ins - a channel's brand colour and a viewer's own theme

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 58 - Modern browse layout · 59 - Modern video watch page · 72 - Settings and customisation · 95 - Design system 2 |
| Blocks | 121 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** ready

> **Why.** 95's engine takes a theme as data: `registerTheme` in `@vp/ui` parses it, runs the contrast gate and
> injects its CSS, and `deriveAccent` in `@vp/design-tokens` turns any hex into an accent set that passes
> ([docs/design/architecture.md section 2](../design/architecture.md#2-themes-and-token-sets)). Nothing calls
> either with a colour that is not a built-in theme's, so a channel looks like every other channel and a viewer
> can pick only an accent.

## What to build

### 1. A channel's brand colour

- Column `brand_color` (hex, nullable) on channels, one migration; the channel resource carries it. A malformed hex is
  refused at the input seam with `ACCENT_PATTERN` from `@vp/domain/settings`, the check 97 uses for the accent; any
  well-formed colour is accepted, and `deriveAccent` steps it until every pair passes.
- Studio: one colour field in the channel settings, with the derived accent previewed in both modes before it is
  saved.
- Web: the channel page and the watch page's channel row scope the derived accent to their subtree
  (`accent`, `accent-hover`, `accent-ink`, `accent-soft`, `focus-ring`, `on-accent`, and nothing else), derived for
  the viewer's mode. A viewer's own accent override wins over the channel's. `live`, `danger` and the status roles
  never change.

### 2. A viewer's own theme

- Settings' appearance page gains "Build your own" ([72](72-frontend-settings-customization-system.md)): a ground
  colour and an accent, from which the app builds a `Theme` over one built-in's remaining defaults.
- `registerTheme` is the gate: a theme that fails contrast shows the failing pairs and is not saved.
- 97's `appearance` section has no field for a built theme, so this ticket adds one (the ground colour and the
  accent) to `@vp/domain/settings`, with the `docs/SDD.md` §6.1 update in the same PR. It is stored through
  [97](97-account-preferences-api.md)'s endpoint and registered again on load; a theme the registry cannot rebuild falls back to the default theme, never to a broken page.

## Acceptance criteria

- [ ] A channel with a brand colour renders its page in the derived accent in every theme and mode, and a hostile
      colour (pure yellow, near-white, near-black) still passes its contrast floors.
- [ ] A malformed hex is refused by the API and the studio field; a well-formed one, even a hostile one, is accepted and derives a passing set.
- [ ] A viewer's accent override wins on a branded channel; status roles are unchanged.
- [ ] A viewer builds a theme that passes, sees it apply with no reload, and gets it back after a reload and on
      another device; one that fails shows its failing pairs and saves nothing.
- [ ] The injected CSS passes the app's CSP.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- Sharing a user-built theme with other viewers, a theme gallery, banner or font theming per channel.

## Testing plan

- Rule: an `it.each` table over valid, malformed and hostile hexes.
- Web: the branded channel page and the builder through `renderRoute`; a spec that a failing theme saves nothing.
- E2E: set a brand colour in the studio app, read the channel page in the web app.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
