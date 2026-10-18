# ErrorState

A whole page or whole route that failed: what went wrong in plain words, and a retry. For a section of a page that failed, use [SectionError](section-error.md). In `@vp/components` because both apps render it for route errors and not-found.

## Anatomy

```
              1 illustration (optional, 180 px)

           2 We could not load this video
           3 The server took too long to answer. Your connection looks fine.

              [ 4 Try again ]   5 Go to Home
              6 Reference 7f3a-91c2   (copy)
```

| # | Region | Notes |
|---|---|---|
| 1 | Illustration | optional, `aria-hidden` |
| 2 | Title | `title-lg`: what went wrong, not "Oops" |
| 3 | Description | `body`, `fg-muted`: why, in one or two sentences, and what the viewer can do |
| 4 | Retry | primary `Button`, with a countdown label while the app auto-retries |
| 5 | Escape route | a link to somewhere safe |
| 6 | Reference | `caption` in `mono`, a trace or request id the viewer can copy for support |

## Props

Plus the standard props. The title is the heading element the caller passes.

```ts
// types.ts
export type ErrorStateKind = 'generic' | 'not-found' | 'forbidden' | 'unauthorised' | 'rate-limited' | 'server';
```

```ts
interface ErrorStateRootProps {
  kind: ErrorStateKind;
  onRetry?: () => void;
}
// Parts: ErrorState.Root, .Illustration, .Title, .Description, .Action, .Reference, .Details
```

```tsx
<ErrorState.Root kind="server" onRetry={retry}>
  <ErrorState.Title><h1>We could not load this video</h1></ErrorState.Title>
  <ErrorState.Description>The server took too long to answer.</ErrorState.Description>
  <ErrorState.Action asChild><Link to="/">Go to Home</Link></ErrorState.Action>
  <ErrorState.Reference value="7f3a-91c2" />
</ErrorState.Root>
```

`kind` drives only the icon and the live-region role, and the retry button appears only when `onRetry` is given (so `not-found` and `forbidden` omit it). The retry label, the spinner while it runs and the "Copied" feedback come from `useUiCopy()`. The copy itself comes from the app's error classification (the `ErrorCode` to `kind` map lives in each app's route error component, not here). Technical details are `<ErrorState.Details>`, passed by the app only in development builds. A rate-limit countdown is the app updating the retry label child; the component holds no timer.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A router link as the escape route | `asChild` on `ErrorState.Action` |
| An extra region (a status page link) | any element inside `ErrorState.Root`, or a part reading `useErrorState()` (kind, retrying) |
| An app-local look | `tv({ extend: errorStateStyles, variants: { ... } })` |

## Variants

| `kind` | Difference |
|---|---|
| `generic`, `server` | retry primary, home escape |
| `not-found` | no retry, a search action and a home link |
| `forbidden` | no retry, a sign-in or request-access action |
| `unauthorised` | the sign-in action is primary |
| `rate-limited` | retry disabled while the app's countdown label runs |

## States

| State | What changes |
|---|---|
| default | as drawn |
| retrying | the retry button shows a `Spinner`, label unchanged, `aria-busy` |
| retry failed | the description is replaced by the new reason; focus stays on the retry button |
| auto-retry | the label carries the countdown ("Trying again in 8 s"), Cancel is not offered, the button retries now |
| copied | the reference button shows the copied label from `useUiCopy()` for two seconds |
| with details | a disclosure with the technical text in `mono` |
| skeleton | none: errors replace skeletons |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | `section` padding block, `gutter-compact` inline, actions stacked full width |
| medium | `page` size, actions side by side |
| expanded | as medium |
| large | as medium |

## Motion

- Entry: opacity at `base` with `enter`; the illustration is static.
- The retry spinner is the one moving thing.
- Reduced motion: no change beyond opacity.

## Accessibility

- A page-level error renders the `h1` of the page; the section size uses `h2`.
- `role="alert"` on the container for failures that appear after the page was usable (a mutation or navigation failed); route-level errors rendered on first load do not use it, since the whole page is the message.
- Retry returns focus to itself after a failure; the escape link is the next tab stop.
- The reference is a button that copies the value and announces "Copied" through a polite live region.
- Colour is never the only signal: `danger-ink` accents come with an icon and words.

## Composition

`Button`, `Callout` (the details disclosure), `Icon`, `Spinner`, `Tooltip` (copy). Type styles: `title-lg`, `body`, `caption` and `mono`.

## Used by

- Web: [70, resilient error handling](../../tickets/70-frontend-resilient-error-handling-retry-policy.md) (route error and not-found components); [59, watch page](../../tickets/59-video-watch-page-responsive-layout-enhancements.md) (not-found video)
- Studio: the route error and not-found components of the `_authed` layout ([93](../../tickets/93-creator-studio-separate-app.md))

## Workbench stories

- Generic with retry
- Not found
- Forbidden
- Unauthorised
- Rate limited with countdown
- Retrying and retry failed
- Reference copied
- With development details
- Compact
- RTL
