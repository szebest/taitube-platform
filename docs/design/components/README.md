# Shared components: `@vp/components`

The specs for every component in `@vp/components` (client, T3), the package that sits above the `@vp/ui` primitives and below the apps. It holds **only what both web and studio render today**. [Ticket 95](../../tickets/95-design-system-2.md) section 6 builds it; [architecture.md](../architecture.md#1-five-layers) places it in the five layers; [the design guide](../README.md) is the look; [`tokens.json`](../tokens.json) holds the values the specs name.

## The "both apps today" rule

- A component is here because web and studio both import it now. Nothing is here "because it will be shared": a piece one app alone uses lives in that app's kit ([web](../apps/web/README.md), [studio](../apps/studio/README.md)).
- A piece moves here from an app kit the day the second app needs it, in the same PR that adds the second import. Never earlier ([architecture section 1](../architecture.md#1-five-layers), [section 6](../architecture.md#6-sharing-between-web-and-studio)).
- `tests/architecture/` holds the rule: every export of `@vp/components` is imported by both apps.
- The package is small on purpose. It is the contract between two apps, and every piece in it is one both must keep working.

## Catalogue

| Component | Purpose | Composes | Web | Studio |
|---|---|---|---|---|
| [PageHeader](page-header.md) | Title, description and actions at the top of a page | `Button`, `IconButton`, `Tabs`, `DropdownMenu` | You hub, library pages, settings | every page |
| [VideoThumbnail](video-thumbnail.md) | The frame of a video: image, duration, progress, badges, live | `AspectRatio`, `Progress`, `Badge`, `Icon` | `VideoCard` | `LibraryVideoRow` |
| [EmptyState](empty-state.md) | One editorial line and one action | `Button` | feeds, queue, comments, search | empty library, no analytics yet, empty table |
| [ErrorState](error-state.md) | A whole page or route that failed, with a retry | `Button`, `Callout`, `Spinner`, `Tooltip` | route error and not-found | route error and not-found |
| [SectionError](section-error.md) | One section failed inside a page that did not | `Callout`, `Button`, `Spinner` | shelves, discussion | tables and charts |
| [Skeletons](skeletons.md) | The loading layout of each component above | `Skeleton` | every page | every page |

Each component exports its own `<Name>Skeleton` from its folder. [skeletons.md](skeletons.md) holds the rule and the dimensions of the shared ones.

## Rules of the package

1. **Presentational.** A component renders what it is given. It fetches nothing, owns no server state, reads no route and no cookie, and imports nothing from `@vp/queries`, `@vp/api-client` or `@vp/forms`. It sits at T3, above `@vp/ui`, and has no edge to its T3 sibling `@vp/forms`.
2. **Props in, events out.** Display values and slots come in as children and compound parts; every user action goes out as a callback (`onRetry`, `onReact`, `onSeek`). A component may keep purely visual state (hover, expanded, an open menu). It never keeps state the app would want to restore: those are controlled.
3. **The app formats.** Numbers, dates, durations and counts reach a component as finished strings, made by the app through `@vp/intl-react` (`compact`, `relative`, `duration`, `list`). Content copy arrives as children. The labels of a component's own built-in controls (Retry, Copied, Read more, the reaction buttons) come from `useUiCopy()` in `@vp/ui`, filled once per app from `@vp/messages`, so callers never pass a `labels` object and this package has no edge to `@vp/messages`. A component calls no `Intl.*`, `toLocaleString` or `toFixed`, and never concatenates a sentence.
4. **No routes.** Links arrive through `asChild`; a component never builds a URL.
5. **Compound, `X.Root`.** A component with more than one region is `X.Root` plus parts sharing context through `createCompoundContext` ([architecture section 4](../architecture.md#4-how-a-component-is-shaped)). Single-element components are one component over native props.
6. **Shared unions.** A prop never spells an inline string-literal union. It uses a union from `@vp/design-tokens` (`SizeOption`, `ControlSize`, `IconSize`, `RadiusOption`, `ElevationOption`, `TypeStyleOption`, `ToneOption`, `ColorRole`), from `@vp/ui` (`FillOption`, `ShapeOption`, `Orientation`, `Align`, `Side`) or from `@vp/domain` and `@vp/api-contracts` (`VideoStatus`, `VideoVisibility`, `ReactionType`), narrowed with `Extract` and `Exclude` in the component's `types.ts`; a union only that component uses lives in the same file ([architecture section 3](../architecture.md#3-shared-option-unions)). Each spec shows its `types.ts` before the props.
7. **Every component owns its skeleton**, `<Name>Skeleton`, with the loaded layout's exact dimensions, so a `pendingComponent` shifts nothing ([skeletons.md](skeletons.md)).
8. **Tokens by role, from the token sets.** Colour by role name; radius by role (`thumb`, `card`, `control`, `chip`, `sheet`); space from the spacing roles (`inset-card`, `gap-stack`...); size from the sizing set (`control`, `icon`, `avatar`, `touch-target`, `row-thumb`); border widths from the border set; elevation 1 to 3; motion durations and easings from the motion set. No hex value, no palette class and no `px` where a token exists; the px in a spec are the values at the default sets, for reading only. See [architecture section 2](../architecture.md#2-themes-and-token-sets).
9. **Logical properties.** `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`; icons that imply direction mirror under `dir="rtl"`, media controls do not.
10. **States are designed.** Every spec lists the states that apply, and each state has a story.
11. **One folder per component**: `src/<name>/` with `<name>.tsx`, `<name>.context.ts`, `<name>.variants.ts`, `types.ts`, `<name>.stories.tsx`, `__tests__/<name>.dom.test.tsx` with the axe check, and `index.ts` exporting `export const Name = { Root, ... }` ([architecture section 4](../architecture.md#one-folder-per-component)). `pnpm gen:component <name> --kind shared [--compound]` scaffolds it.
12. **Composition over configuration.** A slot is a child, not a prop. Three to six props per component, more than eight only with a one-line reason. No props the component can derive or own: no `itemKey`, no `headingLevel` (the caller passes the heading element), no `labels` objects, one enum instead of booleans. Specs do not list the standard props (`className`, `ref`, `children`, `data-*`, `aria-*`); one sentence covers them.
13. **Open for extension.** Every spec ends its design with an Extension points section: `className`, `asChild`, the exported context hook, `tv({ extend })` ([architecture section 4](../architecture.md#open-for-extension-closed-for-modification)).

## Spec shape

Each file follows the same order: summary, Anatomy, Props (a `types.ts` fence, then the interface and a usage sketch), Extension points, Variants, States, Responsive behaviour, Motion, Accessibility, Composition, Used by, Workbench stories. The Props section is the intended public API; the build may rename a prop but must keep the shape (parts as children, callbacks out, shared unions). Sample content in the stories is real-sounding on purpose ("Shot entirely on a 1998 camcorder: Lisbon at night", "Marta Reis Films") so layout is judged against realistic line lengths, including a long title, a long channel name and a title in a right-to-left language.

## Shared vocabulary

- **Breakpoints**: compact 0 to 599 px, medium 600 to 1023, expanded 1024 to 1439, large 1440 and up.
- **Density** is not a component prop. It is the `spacing` and `sizing` token sets (`compact` and `small`); studio starts on them, web on the theme defaults, and every component follows with no code of its own.
- **Links**: any part that navigates takes `asChild`; the app passes its router `Link` as the child, the workbench a plain anchor.
- **Standard props**: every component and part forwards `ref`, merges `className` through `cn` and passes `data-*` and `aria-*` through.
