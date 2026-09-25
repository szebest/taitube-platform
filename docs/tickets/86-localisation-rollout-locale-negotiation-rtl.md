# 86: Localisation rollout — locale negotiation, a second language, SSR locale & RTL

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 63 - SEO and OpenGraph · 72 - Settings & customization system · 85 - Universal Intl formatting core · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

---

## Why this ticket exists

Ticket 85 builds the machinery and proves it with one catalogue. It deliberately ships **no second language**,
because the things a second language actually needs — negotiating a locale, carrying it through an SSR render,
persisting a preference, loading a catalogue without shipping every language to every visitor, and surviving a
right-to-left script — all depend on tickets that were not done yet.

They are done by the time this one starts. This ticket is the proof that the seam works: adding a language is a
data change, not a refactor. If it turns into a refactor, 85 got the seam wrong and this is where that shows.

---

## What to build

### W1 — Locale negotiation, one resolution chain

One place decides the locale, and everything else is told:

1. an explicit route segment or search param, if the URL carries one;
2. the persisted user preference (ticket 72's settings);
3. `Accept-Language`, negotiated against the supported set during the SSR render and handed to the router
   context, so the root route and every loader read the same value;
4. `navigator.languages` on a client-only navigation;
5. `en`.

The negotiated result is passed into `IntlProvider` as a prop — the path ticket 85 W4 left open — so the server
render and the hydration agree by construction rather than by luck. `navigator` is read in exactly one module.

### W2 — A second catalogue, lazily loaded

- Add one real second language. Pick one that **exercises the machinery rather than flattering it**: a locale
  with more than two plural categories and a different grouping separator, so `Intl.PluralRules` and
  `Intl.NumberFormat` are genuinely tested rather than mirrored from English.
- Catalogues load per locale, not all at once. `en` may be in the main chunk; every other language is a dynamic
  import keyed by the negotiated locale, so a visitor downloads one catalogue.
- A drift test fails when a key exists in `en` and not in a sibling catalogue, and when a sibling declares a key
  `en` does not have.

### W3 — SSR locale and document metadata

The server render is [89](89-web-tanstack-start-foundation.md)'s; this ticket carries the locale through it.

- The root route's server render sets `<html lang>` and, where relevant, `dir`.
- The negotiated locale is serialised into the streaming payload so hydration does not re-negotiate.
- Ticket 63's OpenGraph and meta tags render in the negotiated locale; `hreflang` alternates are emitted for
  the supported set.
- A test renders the same route server-side and client-side under the same locale and asserts byte-identical
  markup — the hydration-mismatch guarantee, as a test.

### W4 — The locale control, in settings

- A locale selector in ticket 72's settings surface, persisting through the same preference store as the other
  settings rather than a bespoke key.
- Changing the locale rebuilds the `t` and `format` bindings and re-renders; it does not reload the page and it
  does not clear the query cache.
- The user's own `navigator` locale is offered alongside the supported set, as the crash-course `LocaleChooser`
  does, so a visitor whose language is supported but not selected can find it.

### W5 — RTL

- A logical-property audit: `margin-inline`, `padding-inline`, `inset-inline` instead of `left`/`right` in the
  design-system layer from ticket 55.
- `dir` set from the negotiated locale, and the video player, progress bars and any horizontally-scrolling rail
  checked in RTL — those are where LTR assumptions hide.
- RTL ships **behind the supported-locale list**: if no RTL language is in the set, the audit and the plumbing
  still land, so adding one later is a data change.

### W6 — Docs and enforcement

- `tests/architecture/catalogue-parity.test.ts` — every catalogue has the same key set.
- `tests/architecture/single-locale-source.test.ts` — `navigator.language`/`navigator.languages` is read in one
  module only.
- `docs/standards/formatting-and-i18n.md` gains the negotiation chain, the catalogue loading rule and the RTL
  checklist.
- SDD ADR-25 (from ticket 85) gains a Consequences note recording how a language is added.

---

## Acceptance criteria

- [ ] The resolution chain is implemented in the stated order, in one module; `navigator` is read nowhere else —
      asserted by `single-locale-source.test.ts`.
- [ ] A second language ships, chosen for more than two plural categories and a non-`,` grouping separator; the
      choice and its reason are recorded in the PR.
- [ ] Catalogues load lazily per locale; a bundle report in the PR shows a visitor downloading exactly one.
- [ ] `catalogue-parity.test.ts` fails on a key present in one catalogue and missing from another, in both
      directions — proven by a violating fixture.
- [ ] SSR sets `<html lang>` and `dir`; the negotiated locale is serialised into the payload and not
      re-negotiated on hydration.
- [ ] A test asserts **byte-identical markup** between a server render and a client render of the same route at
      the same locale.
- [ ] `hreflang` alternates are emitted for the supported set; ticket 63's meta tags render in the negotiated
      locale.
- [ ] The locale selector lives in ticket 72's settings surface and uses the same preference store; switching
      locale re-renders without a page reload and without clearing the query cache.
- [ ] The user's `navigator` locale is offered alongside the supported set.
- [ ] Logical CSS properties replace physical ones in the design-system layer; `dir="rtl"` is exercised in a
      test for the player, progress bars and a horizontal rail.
- [ ] **Adding the second language required no change to `@vp/intl` or `@vp/messages` source** — only catalogue
      data and the supported-locale list. Stated explicitly in the PR; if it did require a change, say what and
      why, because that is ticket 85's seam failing.
- [ ] `docs/standards/formatting-and-i18n.md` and SDD ADR-25 updated.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`,
      `pnpm build` and `make smoke-offline` green, with output pasted in the PR.
- [ ] No new runtime dependency (local-first, PRD G11 / SDD P9).

## Out of scope

- **Translating the whole UI.** The catalogue covers what the components rewritten by tickets 55–61 actually
  render; a literal still hardcoded in an unrewritten component is that component's ticket, not this one.
- **Machine translation or a TMS integration.** Catalogues are files in the repo.
- **Per-channel or per-video content language** — that is video metadata, not UI locale.
- **Server-side copy.** The API still returns codes; ticket 85's assertion that `@vp/messages` is unreachable
  from a server package still holds.

## Notes for the implementer

- **Pick the second language for what it tests, not for what is easiest.** A language with the same plural
  rules and separators as English proves nothing and will let a real bug through when the third one arrives.
- **The byte-identical render test is the point of the ticket.** Write it first; it will fail for reasons that
  are cheap to fix now and expensive once more surfaces exist.
- **Do not add a locale prefix to every route** unless SEO requires it. `hreflang` plus a negotiated locale
  covers discovery; a URL segment is a routing change that touches every link in the app.

## Open questions

- **Does the locale belong in the URL?** *Open.* `hreflang` plus negotiation is enough for SEO today. A path
  segment becomes necessary only if the same URL must serve different languages to crawlers; decide with
  ticket 63's SEO evidence rather than up front.
- **Which second language?** *Open by design* — the constraint is recorded (plural categories, separators), the
  choice is the implementer's, and the reason goes in the PR.

## Definition of Done

Every AC above ticked with pasted evidence; `**Status:**` set to `done` and
`python3 docs/tickets/gen-index.py` re-run; branch-protected squash merges per
[docs/standards/git-workflow.md](../standards/git-workflow.md).
