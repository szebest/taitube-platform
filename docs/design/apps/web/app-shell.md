# AppShell

Location: `apps/client/web/src/components/shell/app-shell/`. Web's app kit (58c's shell, moved here by a move-only commit), presentational and compound, built from `@vp/ui` primitives.

The frame around every page: header, rail, drawer and bottom tab bar that swap by breakpoint. It is the quiet chrome the signature moves sit in, and it reserves room for the [Now playing bar](now-playing-bar.md).

## Anatomy

```
 compact                        large
┌─────────────────────┐   ┌──────────────────────────────────────────────┐
│ 1 header            │   │ 1 header  [≡] taitube   [ 3 search  /  ]  + (!) ◯│
├─────────────────────┤   ├────────┬─────────────────────────────────────┤
│   4 content         │   │ 2 rail │          4 content                  │
├─────────────────────┤   │        │   5 now playing (content column)    │
│ 5 now playing bar   │   └────────┴─────────────────────────────────────┘
├─────────────────────┤      7 drawer: the rail as a sheet, medium and up
│ 6 tab bar           │
└─────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` | `layout.header` (64 px), sticky, `bg` at 88 % with a blur; menu, mark, search trigger, create, notifications, account |
| 2 | `Rail` | `layout.rail-expanded` (248 px) or `layout.rail-collapsed` (76 px); groups, then followed channels with a live dot |
| 3 | Search trigger | field-shaped, opens the [command palette](command-palette.md); `Kbd` hint for `/` and `Cmd K` |
| 4 | `Main` | fluid to 2200 px, gutters `gutter-compact`, `gutter-medium`, `gutter-expanded` |
| 5 | `NowPlaying` | slot at the bottom of the content column; the shell pads `Main` by its height |
| 6 | `TabBar` | compact only: Home, Shorts, Subscriptions, You; `layout.touch-target` plus the safe-area inset |
| 7 | Drawer | the rail in a `Drawer`, opened by the menu button |

## Props

```ts
// types.ts
export type AppShellRailState = 'open' | 'collapsed';
export type AppShellVariant = 'default' | 'immersive';
```

```ts
interface AppShellRootProps {
  variant?: AppShellVariant;
  railState: AppShellRailState;
  onRailStateChange: (next: AppShellRailState) => void;
}
```

Items are children, so a link to a route that does not exist is not rendered. `AppShell.Item` and `AppShell.Channel` take `href`, `active` and `asChild` (the wrapper passes its router `Link`; the shell never builds a URL). The drawer state is the shell's. Menu, drawer and skip-link labels come from `useUiCopy()`. `immersive` hides header and rail for a fullscreen [Stage](stage.md) or [ShortsPlayerFrame](shorts-player-frame.md). Studio uses [StudioWorkspace](../studio/studio-workspace.md), not this.

## States

| State | What changes |
|---|---|
| rail collapsed | icons with a `Tooltip` each; group headings and the followed list hidden |
| drawer open | `scrim`, rail as a sheet, focus trapped, `aria-modal` |
| item active | `accent-soft` ground, `accent-ink`, `aria-current="page"` |
| channel live | `live` dot at the avatar, text for screen readers |
| scrolled | header gains a `border.divider` bottom edge |

## Responsive behaviour

| Breakpoint | Shell |
|---|---|
| compact | search icon only, no rail, tab bar fixed, now playing above the tabs, menu opens the drawer |
| medium | collapsed rail, gutter `gutter-medium` |
| expanded | collapsed rail that opens over the content (no reflow) on demand, closes on Escape or outside press |
| large | open rail, content reflows beside it |

## Skeleton

`AppShellSkeleton`: header `layout.header` high with an `control.md` circle menu, a 28 by 120 mark, a 100 % by `control.md` search bar capped at 640 px; rail `layout.rail-expanded` (`layout.rail-collapsed` when collapsed) with eight `control.md` rows at 2 px gap, no followed list. Rules in [skeletons](../../components/skeletons.md).

## Motion

Drawer and expanded-rail open: `base` with `enter`, close `exit`; none when opened by keyboard. Rail width on large: `base` with `settle`, width only, labels fade. Active ground: `fast`. Reduced motion: instant width and slide, fades stay.

## Accessibility

- Landmarks: `header`, a `nav` for the rail, a `nav` for the tab bar, `main#main`. Skip link first; DOM order: skip link, header, rail, main, now playing, tab bar.
- The collapsed rail keeps each name as visually hidden text, not the tooltip alone.
- The drawer is a modal dialog: focus to the first item, back to the menu button, Escape closes.
- `/` and `Cmd K` open the palette outside inputs. Tab bar and rail rows are at least `layout.touch-target`.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Item`, `Channel` and the header search trigger.
- `useAppShell()` returns `{ variant, railState, setRailState, drawerOpen, setDrawerOpen }` for an app-local part such as a rail footer.
- `tv({ extend: appShellStyles, variants: { ... } })` for a local look; a different rail layout is a composition of `Rail`, `Section` and your own element.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `RootShell` | `shell/components/` | `children` | `useRailPreference` (cookie), `useRouterState`, `useCan`, `useT`, `useImmersive` |
| `ShellRail` | `shell/components/` | none | `useSubscriptions` (followed channels, live), `useCan`, `useT` |
| `ShellAccountMenu` | `shell/components/` | none | `useSession`, `useAppearance`, `useT` |
| `ShellTabBar` | `shell/components/` | none | `useRouterState`, `useT` |

```tsx
<AppShell.Root railState={railState} onRailStateChange={setRailState}>
  <AppShell.Header logo={<Logo />} search={<SearchTrigger />} actions={<HeaderNotificationCentre />} account={<ShellAccountMenu />} />
  <ShellRail />
  <ShellTabBar />
  <AppShell.NowPlaying><GlobalNowPlayingBar /></AppShell.NowPlaying>
  <AppShell.Main>{children}</AppShell.Main>
</AppShell.Root>
```

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) mounts it from `__root.tsx`; [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md) and [61](../../../tickets/61-admin-control-panel-category-moderation-ui.md) reuse its header; [95](../../../tickets/95-design-system-2.md).

## Workbench stories

Large with a live followed channel; medium collapsed with tooltips; expanded rail over content; compact with tab bar and now playing; drawer open; active item per group; long channel names; RTL; immersive; skeleton.
