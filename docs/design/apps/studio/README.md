# Studio kit

The specs for the creator studio's own components, in `apps/client/studio/src/components/<area>/<name>/` ([architecture section 1](../../architecture.md#1-five-layers), app kit layer). They are presentational and compound, built from the [`@vp/ui` primitives](../../primitives/README.md) and the [`@vp/components`](../../components/README.md) shared components, and they follow the same rules as the shared ones: `X.Root` and parts, shared option unions in a `types.ts`, tokens by role from the token sets, copy through `useUiCopy()`, formatting by the app. [Ticket 95](../../../tickets/95-design-system-2.md) section 8 builds them; [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md) and [61](../../../tickets/61-admin-control-panel-category-moderation-ui.md) use them.

## Where things live

```
apps/client/studio/src/
  components/                      this kit: presentational, no data, no routes
    workspace/studio-workspace/    StudioWorkspace
    table/data-table/              DataTable
    analytics/stat-card/           StatCard
    analytics/charts/              ChartFrame and the chart helpers
  features/<feature>/components/   smart wrappers (below): data, formatting, permissions
```

Each folder is the standard component folder: the component, its context file, variants, `types.ts`, story, jsdom spec and `index.ts` (`pnpm gen:component <name> --kind studio [--compound]`).

## Nothing here is in `@vp/components` until web needs it

These components exist for the studio alone today, so they stay in the studio's kit ([the both-apps rule](../../components/README.md#the-both-apps-today-rule)). The day web renders one of them (an analytics card on a channel page, a table in an account page), the component moves to `@vp/components` in the PR that adds web's import, and its spec moves with it. What the studio shares with web today is already shared: `PageHeader`, `VideoThumbnail`, `CommentItem`, the empty, error, offline and section-error states, and the primitives, `Table` among them.

## Catalogue

| Component | Purpose | Composes | Used by |
|---|---|---|---|
| [StudioWorkspace](studio-workspace.md) | Navigation, toolbar, content, inspector | `ScrollArea`, `IconButton`, `Drawer`, `Dialog` (sheet), `Tooltip`, `Separator` | [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md), [93](../../../tickets/93-creator-studio-separate-app.md) |
| [DataTable](data-table.md) | Studio table behaviour over the `Table` primitive and TanStack Table state | `Table`, `Checkbox`, `Badge`, `DropdownMenu`, `Button`, `Skeleton` | [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md), [61](../../../tickets/61-admin-control-panel-category-moderation-ui.md) |
| [StatCard](stat-card.md) | One KPI with delta and sparkline | `Card`, `Badge`, `Icon` | [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md) |
| [Charts](charts.md) | `ChartFrame` and the palette helpers every chart follows | `Skeleton`, `Badge` | [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md) |

## Smart wrappers the studio needs

A wrapper is the one place a kit component meets data ([architecture section 5](../../architecture.md#5-smart-wrappers-in-the-apps)): base settings fixed inside, dynamic data from hooks, props only the entity and its placement. Each wrapper lives in the feature that owns its data, never in this kit. Each spec's Smart wrappers section lists the ones for that component; the studio's set:

| Wrapper | Feature folder | Props | Hooks | Builds on |
|---|---|---|---|---|
| `LibraryVideoRow` | `features/content/components/` | `video: CreatorVideo`, `onInspect: (videoId: string) => void` | `useFormat`, `useT`, `useCan`, `useVideoActions` | `DataTable` row cells, `VideoThumbnail` |
| `LibraryTable` | `features/content/components/` | `onInspect: (videoId: string) => void` | `useSearch` (route params), `useSuspenseQuery(myVideosQueryOptions)`, `useReactTable`, `useCan`, `useBatchActions`, `useT` | `DataTable`, `LibraryVideoRow`, `EmptyState`, `SectionError` |
| `KpiCard` | `features/analytics/components/` | `metric: KpiMetric`, `range: AnalyticsRange` | `useChannelAnalytics`, `useFormat`, `useT` | `StatCard` |
| `ViewsChart` | `features/analytics/components/` | `range: AnalyticsRange` | `useChannelAnalytics`, `useChartTheme`, `useFormat`, `useT` | `ChartFrame` and the charting library |
| `StudioShell` | `features/shell/components/` | none (reads the route and session) | `useMatchRoute`, `useUploadProgress`, `useCan`, `useT`, `useSelectedVideo` | `StudioWorkspace` |
| `CategoryTable` | `features/admin/components/` | none | `useSearch`, `useSuspenseQuery`, `useReactTable`, `useCan`, `useT` | `DataTable` |

`CreatorVideo` is the item of `listCreatorVideos`' response in `@vp/api-contracts`; `KpiMetric` (`'views' | 'watch-time' | 'subscribers' | 'average-view-duration'`) and `AnalyticsRange` live in `features/analytics/types.ts`, since they are the feature's own vocabulary, not a component's. `LibraryVideoRow` is the reference wrapper [ticket 95](../../../tickets/95-design-system-2.md) section 8 writes, shaped like web's `FeedVideoCard`.

## Rules, as for every component

- **Shared unions**: a props type never spells an inline literal union; shared ones come from `@vp/design-tokens`, `@vp/ui` types, `@vp/domain` and `@vp/api-contracts`, narrowed with `Extract` and `Exclude` in `types.ts`; a component-only union lives there too.
- **Density is a token set, not a prop.** The studio's defaults are `spacing: compact` and `sizing: small`; every component follows through spacing roles and the sizing set.
- **Every component owns its skeleton**, with the loaded layout's exact dimensions; each studio spec has a Skeleton section.
- **Extension points** on every component: `className`, `asChild`, the exported context hook, `tv({ extend })`.
