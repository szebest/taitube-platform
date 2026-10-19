# CommandPalette

Location: `apps/client/web/src/components/shell/command-palette/`. Web's app kit, presentational and compound, built from `@vp/ui` primitives (`Command`, `Dialog`, `Drawer`).

A dialog with a field, grouped results and actions, opened by the header search, `/` or `Cmd K`. It carries the "Command palette" signature move: search that also runs actions ("Switch to Nocturne", "Open Watch later", "Upload a video").

## Anatomy

```
┌──────────────────────────────────────────────┐
│ (o) 1 lisbon                          [esc] 2  │
├──────────────────────────────────────────────┤
│ 3 Videos                                      │
│ ▢ Shot entirely on a 1998 camcorder  18:42    │
│ Channels                                      │
│ ◯ Lisbon Walks  @lisbonwalks  41K subscribers   │
│ 4 Actions                                     │
│ ◫ Switch to Nocturne                  theme   │
├──────────────────────────────────────────────┤
│ ↑↓ navigate   ↵ open   ⇥ 5 search all results │
└──────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Input` | `body`, autofocus, clear button when filled |
| 2 | Close hint | `Kbd`; a Cancel button on compact |
| 3 | `Group` | videos, channels, playlists, suggestions; `overline` heading |
| 4 | `Group` of actions | verbs matching the query with a shortcut `Kbd` or hint tag |
| 5 | Footer | key hints; Enter on the raw query opens the results page |

## Props

```ts
// types.ts
export type CommandPaletteVariant = 'dialog' | 'sheet';
```

```ts
interface CommandPaletteRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSubmitQuery: (query: string) => void;
}

interface CommandPaletteItemProps {
  value: string;
  onSelect: () => void;
  meta?: string;
  shortcut?: string[];
  leading?: ReactNode;
}
```

The query is controlled because the wrapper debounces it and fetches ([74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md)). The kit filters nothing and keeps no results. Match highlighting is a `<mark>` in the item's children; an item that navigates takes `asChild`. The variant follows the breakpoint; placeholder and footer hints come from `useUiCopy()`.

## Variants

| Variant | Layout |
|---|---|
| `dialog` | centred, 640 px, radius `sheet`, `raised`, `elevation-3`, medium and up |
| `sheet` | full-height `Drawer` from the top on compact, visible Cancel |

## States

| State | What changes |
|---|---|
| empty query | recent searches and default actions |
| typing | results update in place; the active item resets to the first |
| loading | a 2 px `accent` line under the field; existing results stay |
| no results | empty message plus the actions group, which still matches |
| error | a `SectionError` line with retry; actions keep working |
| offline | actions and recents, a one-line notice |
| item active | `accent-soft`, `aria-selected` |

## Responsive behaviour

Compact: `sheet`, rows 56 px, no footer hints. Medium: `dialog` 560 px, 12 vh from the top. Expanded and large: 640 px; large rows show the secondary and meta columns.

## Skeleton

`CommandPaletteSkeleton`: three rows 56 px high, each a 40 by 40 px leading block (`control.md`) and bars 60 % and 30 %. Rules in [skeletons](../../components/skeletons.md).

## Motion

Pointer open: fade and 8 px rise at `base` with `enter`, close `exit`. Keyboard open (`/`, `Cmd K`) never animates. Row highlight is instant. Reduced motion: opacity only.

## Accessibility

- `role="dialog"` `aria-modal`; the field is a `combobox` with `aria-controls` and `aria-activedescendant`; groups are `role="group"` with `aria-labelledby`.
- Arrows move, Enter selects, Tab goes to the "all results" action, Escape closes and returns focus. Home and End jump.
- The result count is a polite live region. Matches are `mark` with weight 700, not colour alone.
- `/` is ignored while focus is in an input or contenteditable.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Item` (a router `Link`) and `Input`.
- `useCommandPalette()` returns `{ open, query, setQuery, close }` so an app-local group closes it after running.
- `tv({ extend: commandPaletteStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `AppCommandPalette` | `search/components/` | none | `useCommandPaletteStore` (open, `/` and `Cmd K`), `useSearchSuggestions` (debounced), `useRecentSearches`, `useNavigate`, `useT` |
| `PaletteResultItem` | `search/components/` | `result: SearchResultItem` (its `kind` is a `SearchResultKind`) | `useFormat`, `useT` |
| `PaletteActionItem` | `search/components/` | `action: CommandAction` | `useCan`, `useAppearance`, `useT` |

The action list is built in `useCommandActions()`: appearance actions come from the registry (`@vp/ui/appearance`), and an action behind a permission is filtered by `useCan`.

## Used by

[74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) grouped results, suggestions, actions; [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) the header field.

## Workbench stories

Empty query; video, channel and playlist groups; highlighted matches; actions only; loading; no results; error; offline; compact sheet; keyboard open with no animation; RTL.
