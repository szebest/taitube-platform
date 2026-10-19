# OfflineState

Location: `apps/client/web/src/components/states/offline-state/`. Web's app kit, presentational and compound, built from `@vp/ui` primitives. Studio has no service worker ([93](../../../tickets/93-creator-studio-separate-app.md)), so it stays here until studio adds an offline route.

What still works when the connection is gone. It is honest and specific: it lists what is available offline, not an apology.

## Anatomy

```
 ┌──────────────────────────────────────────────────────────┐
 │ 1 (icon)  2 You are offline                              │
 │           3 Saved videos and your queue still work.      │
 │ 4 Available offline:                                     │
 │   o Watch later (6 videos)    o Downloads (2 videos)     │
 │                         [ 5 Try again ]  [ 6 Open Downloads ]│
 └──────────────────────────────────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Icon | a "no signal" `Icon`, `fg-muted`, `icon.lg` (`IconSize`) |
| 2 | Title | `title` or `title-lg` by size |
| 3 | Description | `body`, `fg-muted`: what is unavailable and why |
| 4 | Offline list | links to what the service worker has cached, each with a count |
| 5 | Retry | `Button` that checks the connection |
| 6 | Primary offline action | a link to the best thing available |

## Props

Plus the standard props. What is available offline is a list of children the app builds from the cache ([68](../../../tickets/68-pwa-service-worker-offline-cache-background-sync.md)).

```ts
// types.ts
import type { ToneOption } from '@vp/design-tokens';

export type OfflineStateSize = 'page' | 'banner' | 'section';
export type OfflineStateTone = Extract<ToneOption, 'neutral' | 'success'>;
```

```ts
interface OfflineStateRootProps {
  size?: OfflineStateSize;  // default 'page'
  tone?: OfflineStateTone;  // default 'neutral'; 'success' is the reconnected confirmation
  onRetry: () => void;
}
// Parts: OfflineState.Root, .Title, .Description, .Available, .Link, .Reconnected
```

```tsx
<OfflineState.Root size="page" onRetry={check}>
  <OfflineState.Title>You are offline</OfflineState.Title>
  <OfflineState.Description>Saved videos and your queue still work.</OfflineState.Description>
  <OfflineState.Available>
    <OfflineState.Link count="6 videos" asChild><Link to="/feed/watch-later">Watch later</Link></OfflineState.Link>
  </OfflineState.Available>
</OfflineState.Root>
```

The reconnected confirmation is the app swapping the children for `<OfflineState.Reconnected />` with `tone="success"`, which dismisses itself after four seconds. The retry label and its checking spinner come from `useUiCopy()`.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| Router links in the list | `asChild` on `OfflineState.Link` |
| An extra region (queued changes) | any element inside `OfflineState.Root`, or a part reading `useOfflineState()` (size, checking) |
| An app-local look | `tv({ extend: offlineStateStyles, variants: { ... } })` |

## Skeleton

None: the state is about a missing connection, so there is nothing to load.

## Variants

| `size` | Layout |
|---|---|
| `page` | centred like [EmptyState](../../components/empty-state.md) `page`, with the available list as cards |
| `banner` | a slim bar under the header, `raised` ground, one line and a retry; the page stays usable |
| `section` | a card in place of a section that needs the network, with the available list collapsed |

## States

| State | What changes |
|---|---|
| offline | as drawn |
| checking | retry shows a `Spinner`; the label is unchanged |
| still offline | the app adds a last-online line to the description ("Last online 4 minutes ago") |
| nothing available | the list is absent and the description says so |
| reconnected | `tone="success"`: `success-ink` check and the reconnected line, the banner dismisses itself after 4 s |
| queued actions | the description notes how many changes will sync when the connection returns |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | banner sits above the tab bar's content, full width, retry as an icon button; `page` actions stacked |
| medium | banner under the header |
| expanded | as medium |
| large | as medium; the `page` list shows three columns |

## Motion

- Banner enters by sliding down 8 px and fading at `base` with `enter`, leaves with `exit`.
- The reconnected tick draws once at `base`.
- Reduced motion: opacity only.

## Accessibility

- The banner is `role="status"` with `aria-live="polite"`, announced once when connectivity changes, never repeatedly.
- `page` and `section` sizes use a heading and a list; the available items are links.
- Retry is a button; its result is announced through the same live region ("Still offline", "Back online").
- Status colour is paired with the icon and the words.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `OfflineBanner` | `offline/components/` | none | `useOnlineStatus`, `useOfflineCache` (the lists), `useQueuedChanges`, `useT` |
| `OfflineRoute` | `offline/components/` | none | the same, fixed to `size="page"` |

`OfflineBanner` mounts under the shell header, fixes `size="banner"` and swaps in `OfflineState.Reconnected` on reconnect.

## Composition

`Callout`, `Button`, `Icon`, `Spinner`, `Card` (section size).

## Used by

- Web: [68, PWA and offline cache](../../../tickets/68-pwa-service-worker-offline-cache-background-sync.md) (the offline fallback route); [70, resilient error handling](../../../tickets/70-frontend-resilient-error-handling-retry-policy.md) (network failures route here instead of [ErrorState](../../components/error-state.md))
- Studio: none today

## Workbench stories

- Page with two available lists
- Banner
- Section in place of comments
- Still offline with last-online time
- Nothing available
- Reconnected
- With queued changes
- Compact banner
- RTL
