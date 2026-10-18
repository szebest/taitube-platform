# Web's app kit

Specs for the components in `apps/client/web/src/components/<area>/<name>/`. Each is presentational and compound,
built from `@vp/components` (shared: `PageHeader`, `VideoThumbnail`, `EmptyState`, `ErrorState`, `SectionError`)
and `@vp/ui` primitives. Nothing here goes into a package, and studio never imports it
([architecture section 1](../../architecture.md#1-five-layers)). A piece moves to `@vp/components` the day studio
needs it. [Ticket 95](../../../tickets/95-design-system-2.md) section 7 builds it.

Areas: `shell`, `video`, `watch`, `channel`, `discovery`, `discussion`, `states`, `live`, `shorts`.

## Catalogue

| Component | Area | Purpose | Built from | Page tickets |
|---|---|---|---|---|
| [AppShell](app-shell.md) | shell | header, rail, drawer, tab bar | `Drawer`, `Tooltip`, `Avatar`, `IconButton` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [60](../../../tickets/60-creator-studio-dashboard-video-management-ui.md), [61](../../../tickets/61-admin-control-panel-category-moderation-ui.md) |
| [NowPlayingBar](now-playing-bar.md) | shell | playback that survives navigation | `Progress`, `IconButton`, `Spinner` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md), [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) |
| [CommandPalette](command-palette.md) | shell | search that also runs actions | `Command`, `Dialog`, `Drawer`, `Kbd` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) |
| [NotificationCentre](notification-centre.md) | shell | bell popover, a shell until data | `Popover`, `Drawer`, `Badge`, `Tabs` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [95](../../../tickets/95-design-system-2.md) |
| [VideoCard](video-card.md) | video | the one card for every video | `VideoThumbnail`, `Avatar`, `HoverCard`, `DropdownMenu` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md), [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md), [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) |
| [Shelf](shelf.md) | discovery | headed horizontal scroller | `IconButton`, `ScrollArea` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) |
| [ChipBar](chip-bar.md) | discovery | category and filter chips | `Chip`, `IconButton` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) |
| [PickOfTheDay](pick-of-the-day.md) | discovery | Home hero | `VideoCard`, `Button` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) |
| [Stage](stage.md) | watch | media ground and ambient glow | `AspectRatio`, `Spinner`, `Button` | [57](../../../tickets/57-production-video-player-hls-streaming-controls.md), [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) |
| [EngagementBar](engagement-bar.md) | watch | channel, subscribe, reactions, actions | `Avatar`, `Button`, `ToggleGroup`, `DropdownMenu` | [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md), [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) |
| [LinerNotes](liner-notes.md) | watch | description, chapters | `Card`, `Chip`, `ScrollArea` | [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) |
| [Queue](queue.md) | watch | the viewer's reorderable queue | `VideoCard`, `ToggleGroup`, `Drawer` | [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md), [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) |
| [CommentItem](comment-item.md) | discussion | one comment, replies, reactions | `Avatar`, `Badge`, `IconButton`, `DropdownMenu` | [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) |
| [OfflineState](offline-state.md) | states | what still works offline | `Callout`, `Button`, `Card` | [68](../../../tickets/68-pwa-service-worker-offline-cache-background-sync.md), [70](../../../tickets/70-frontend-resilient-error-handling-retry-policy.md) |
| [CommentThread](comment-thread.md) | watch | discussion shell | [CommentItem](comment-item.md), `Textarea`, `SegmentedControl` | [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) |
| [ChannelHeader](channel-header.md) | channel | banner, identity, tabs | `Avatar`, `Tabs`, `Button` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) |
| [StartHereShelf](start-here-shelf.md) | channel | pinned or popular videos for newcomers | `Shelf`, `VideoCard` | [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md), [96](../../../tickets/96-channel-featured-videos-start-here.md) |
| [LiveChat](live-chat.md) | live | docked or overlay chat | `ScrollArea`, `Textarea`, `Slider` | [76](../../../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md), [95](../../../tickets/95-design-system-2.md) |
| [ShortsPlayerFrame](shorts-player-frame.md) | shorts | 9:16 player with actions | `IconButton`, `Progress`, Stage ground | [95](../../../tickets/95-design-system-2.md) |

## Rules

1. **Presentational.** No data hooks, router, query client or API import. Links come through `asChild`, data and
   callbacks through props. A smart wrapper connects them (below).
2. **`X.Root` and parts.** A component with more than one region is `X.Root` plus parts sharing state through
   context, one folder per component (`<name>.tsx`, `<name>.context.ts` with `useX()`, `<name>.variants.ts`,
   `types.ts`, story, test, `index.ts`). Content is children, never a `title` or `footer` prop.
3. **Shared unions.** Every union prop is a shared one (`SizeOption`, `ControlSize`, `ToneOption`... from
   `@vp/design-tokens`; `Side`, `Orientation`... from `@vp/ui`; `VideoStatus`, `ReactionType`, `CommentSort`,
   `SearchType`... from `@vp/domain`), narrowed with `Extract` or `Exclude` in the folder's `types.ts`. A union
   only this component uses lives in the same `types.ts`. No inline literal union in a props interface
   ([architecture section 3](../../architecture.md#3-shared-option-unions)).
4. **Tokens, not values.** Sizes, spacing roles, radius roles, type styles, elevation, ambient and motion come
   from the token sets ([architecture section 2](../../architecture.md#2-themes-and-token-sets)); no hex, ramp step
   or palette class. Ambient glows obey `data-ambient="off"`.
5. **Copy through `useUiCopy()`.** Labels for the kit's own controls (chevrons, Show more, drawer and skip-link
   names) come from `useUiCopy()`. Product words ("Subscribe", "Because you watched") arrive as children from the
   wrapper, through `useT`.
6. **The app formats.** A component takes finished strings (`"412K views"`, `"18:42"`); the wrapper formats with
   `useFormat()`. The kit never calls `Intl`.
7. **Skeletons.** Each component exports `<Name>Skeleton` with the loaded layout's exact dimensions; its spec has
   a Skeleton section, and the shared rules are in [skeletons](../../components/skeletons.md).
8. **Extension.** `className`, `asChild`, the exported `useX()` hook and `tv({ extend })`
   ([architecture section 4](../../architecture.md#open-for-extension-closed-for-modification)). A new layout is a
   composition, never a new boolean.

## Smart wrappers

A wrapper lives in `apps/client/web/src/features/<feature>/components/`, one per placement, never in the kit
([architecture section 5](../../architecture.md#5-smart-wrappers-in-the-apps)). Its base settings are fixed inside
it; props are the entity (or its id) and at most one placement fact. `Video`, `VideoSummary`, `CommentView`,
`Channel` and the other entities come from `@vp/api-contracts`. Every wrapper also calls `useT` for copy.

| Kit component | Wrapper | Feature | Props | Reads |
|---|---|---|---|---|
| [AppShell](app-shell.md) | `RootShell` | `shell` | `children` | rail preference, router state, `useCan` |
| | `ShellRail` | `shell` | none | `useSubscriptions` |
| | `ShellAccountMenu` | `shell` | none | `useSession`, `useAppearance` |
| | `ShellTabBar` | `shell` | none | router state |
| [NowPlayingBar](now-playing-bar.md) | `GlobalNowPlayingBar` | `watch` | none | `usePlayback`, `usePlaybackQueue` |
| [CommandPalette](command-palette.md) | `AppCommandPalette` | `search` | none | palette store, `useSearchSuggestions`, `useRecentSearches` |
| | `PaletteResultItem` | `search` | `result: SearchResultItem` | `useFormat` |
| | `PaletteActionItem` | `search` | `action: CommandAction` | `useCan`, `useAppearance` |
| [NotificationCentre](notification-centre.md) | `HeaderNotificationCentre` | `notifications` | none | `useNotifications`, `useMarkAllRead` |
| | `NotificationRow` | `notifications` | `notification` | `useFormat` |
| [VideoCard](video-card.md) | `FeedVideoCard` | `browse` | `video: VideoSummary`, `reason?: ShelfReason` | `useWatchProgress`, `useVideoActions` |
| | `ShortPosterCard` | `shorts` | `video: VideoSummary` | `useFormat` |
| | `QueueVideoRow` | `watch` | `video: VideoSummary`, `current?: boolean` | `usePlaybackQueue` |
| | `SearchVideoResult` | `search` | `result: SearchResultItem` | `useVideoActions` |
| | `HistoryVideoRow` | `library` | `item: WatchHistoryItemView` | `useRemoveFromHistory` |
| [Shelf](shelf.md) | `ReasonShelf` | `browse` | `reason: ShelfReason` | `useFeedShelf` |
| | `ContinueWatchingShelf`, `ShortsShelf`, `LiveNowShelf` | `browse` | none | `useWatchHistory`, `useShortsFeed`, `useLiveStreams` |
| | `FollowedChannelsShelf` | `library` | none | `useSubscriptions` |
| [ChipBar](chip-bar.md) | `CategoryChipBar` | `browse` | none | `useCategories`, the `category` search param |
| | `SearchTypeChipBar` | `search` | `counts: Partial<Record<SearchType, number>>` | the `type` search param |
| [PickOfTheDay](pick-of-the-day.md) | `HomePickOfTheDay` | `browse` | none | `usePickOfTheDay`, `useAmbientSample` |
| [Stage](stage.md) | `WatchStage` | `watch` | `video: Video` | `useAmbientSample`, `usePlayback` |
| [EngagementBar](engagement-bar.md) | `WatchEngagementBar` | `watch` | `video: Video` | `useSubscription`, `useReaction`, `useShare` |
| [LinerNotes](liner-notes.md) | `WatchLinerNotes` | `watch` | `video: Video` | `usePlayerSeek`, `useCurrentChapter` |
| [Queue](queue.md) | `WatchQueue` | `watch` | none | `usePlaybackQueue`, `useReorderQueue`, `useRelatedVideos` |
| [CommentThread](comment-thread.md) | `WatchCommentThread` | `watch` | `videoId: string` | `useComments`, `usePostComment`, `useSession` |
| | `ShortsCommentSheet` | `shorts` | `videoId: string` | as above, `layout="sheet"` |
| [CommentItem](comment-item.md) | `VideoCommentItem` | `watch` | `comment: CommentView` | `useCommentReplies`, `useReactComment`, `useCan` |
| [OfflineState](offline-state.md) | `OfflineBanner`, `OfflineRoute` | `offline` | none | `useOnlineStatus`, `useOfflineCache` |
| [ChannelHeader](channel-header.md) | `ChannelPageHeader` | `channels` | `channel: Channel` | `useSubscription`, `useChannelTabs`, `useAmbientSample` |
| | `ChannelResultHeader` | `search` | `channel: ChannelCard` | `useSubscription` |
| [StartHereShelf](start-here-shelf.md) | `ChannelStartHere` | `channels` | `channelId: string` | `useChannelFeatured`, `useChannelVideos` |
| [LiveChat](live-chat.md) | `LiveStreamChat` | `live` | `streamId: string` | `useLiveChat`, `usePlayerLayout` |
| [ShortsPlayerFrame](shorts-player-frame.md) | `ShortsFeedFrame` | `shorts` | `short: VideoSummary` | `useShortsNavigation`, `useReaction` |

Ticket 95 builds one of these, `FeedVideoCard`, as the reference the page tickets copy; the rest arrive with the
page ticket that needs them.
